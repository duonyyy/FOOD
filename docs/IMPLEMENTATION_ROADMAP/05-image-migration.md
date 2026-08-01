# Phase 5 — Kiểm kê và di chuyển hình ảnh sang MinIO

## 1. Mục tiêu

Di chuyển có kiểm soát các hình ảnh dự án sở hữu hoặc có quyền sử dụng sang MinIO, đồng thời giữ ứng dụng hoạt động với các URL bên ngoài chưa thể di chuyển.

Phase này ưu tiên tính đúng đắn và khả năng rollback hơn tốc độ.

## 2. Sự thật dễ bị bỏ sót

- Một URL đang hiển thị được không có nghĩa dự án có quyền sao chép và lưu lại nội dung đó.
- URL seed từ Pexels, TestingBot hoặc domain khác có thể hết hạn, chống hotlink hoặc thay đổi nội dung.
- Di chuyển file không chỉ là tải và upload: còn phải cập nhật tham chiếu DB, cache, CDN và dữ liệu rollback.
- Không nên đổi DB trước khi xác minh object mới đọc được.
- Không được tải tài liệu private bằng một script không kiểm soát log và quyền truy cập.

## 3. Điều kiện bắt đầu

- Phase 4 đã hoàn thành.
- Có backup database đã thử restore.
- Hai bucket và policy đã kiểm chứng.
- Reader của API hỗ trợ song song URL tuyệt đối cũ và object key mới.
- Có môi trường staging hoặc bản sao dữ liệu để chạy thử.

## 4. Phân loại nguồn dữ liệu

Tạo inventory theo từng trường ảnh, ví dụ:

| Entity | Trường | Public/private | Nguồn hiện tại | Quyền sử dụng | Hành động |
|---|---|---|---|---|---|
| Food | image | Public | GCS nội bộ | Đã xác minh | Migrate |
| Restaurant | avatar | Public | URL seed ngoài | Chưa rõ | Giữ URL |
| Promotion | image | Public | File dự án sở hữu | Đã xác minh | Migrate |
| Shipper | citizenIdImage | Private | GCS nội bộ | Dữ liệu nghiệp vụ | Migrate bảo mật |

Trạng thái quyền đề xuất:

- `owned`: dự án tạo hoặc được chuyển giao.
- `licensed`: có giấy phép rõ ràng.
- `internal`: upload bởi user qua hệ thống.
- `unknown`: chưa xác minh.
- `prohibited`: không được sao chép.

Chỉ tự động migrate `owned`, `licensed`, `internal`. `unknown` giữ URL và đưa vào danh sách cần xử lý thủ công.

## 5. Thiết kế dữ liệu chuyển tiếp

Nếu schema hiện chỉ có một cột URL, cân nhắc thêm các cột nullable:

```text
image_url              URL cũ hoặc URL ngoài
image_storage_key      key mới trong storage
image_storage_bucket   public/private
image_storage_provider minio/gcs/external
```

Không nhất thiết thêm bốn cột cho mọi bảng nếu có bảng media chung. Lựa chọn schema phải được ghi ADR trước khi migration.

Quy tắc đọc:

1. Nếu có `storageKey`, tạo URL theo provider/bucket.
2. Nếu không, dùng `imageUrl` cũ.
3. Nếu cả hai thiếu, dùng placeholder được quản lý bởi dự án.

Quy tắc ghi mới:

- Sau cutover, upload mới ghi key/provider thay vì URL hạ tầng cứng.
- Có thể giữ snapshot URL trong giai đoạn đầu để hỗ trợ rollback.

## 6. Manifest migration

Mọi lần chạy phải tạo manifest JSON hoặc CSV. Tối thiểu gồm:

```text
runId
entityType
entityId
field
sourceUrl
sourceProvider
rightsStatus
targetBucket
targetKey
contentType
size
sourceChecksum
targetEtag
status
attemptCount
errorCode
errorMessage
startedAt
completedAt
previousDatabaseValue
```

Các trạng thái:

```text
DISCOVERED → ELIGIBLE → DOWNLOADED → UPLOADED → VERIFIED → DB_UPDATED
                      ↘ SKIPPED_RIGHTS
                      ↘ FAILED_RETRYABLE
                      ↘ FAILED_FINAL
```

Manifest phải được lưu ngoài log console, có version và được backup cùng báo cáo migration.

## 7. Xây migration tool an toàn

### Bước 5.1 — Chế độ inventory

Script chỉ đọc database và xuất báo cáo:

- Tổng số bản ghi theo entity/field.
- Số URL null, malformed và trùng lặp.
- Số URL theo domain/provider.
- Số object đã là MinIO/GCS managed object.
- Số item có/chưa có trạng thái quyền.
- Ước lượng tổng dung lượng nếu có thể lấy metadata an toàn.

Không tải hoặc sửa dữ liệu trong chế độ này.

### Bước 5.2 — Chế độ dry-run

Dry-run phải:

- Chọn item đủ điều kiện.
- Tính target bucket/key.
- Kiểm tra trùng key.
- Hiển thị thay đổi DB dự kiến.
- Không upload và không update DB.
- Trả exit code khác 0 nếu có lỗi cấu hình nghiêm trọng.

### Bước 5.3 — Chế độ migrate

Với mỗi item:

1. Khóa logic hoặc đánh dấu item đang xử lý để tránh hai worker cùng làm.
2. Kiểm tra item chưa hoàn thành trong manifest trước đó.
3. Xác minh nguồn thuộc danh sách được phép.
4. Tải file với timeout, giới hạn redirect và giới hạn kích thước.
5. Không gửi credential nội bộ đến domain khi redirect.
6. Xác minh HTTP status, MIME và magic bytes.
7. Tính checksum.
8. Upload vào đúng bucket/key.
9. Đọc metadata hoặc tải kiểm tra object đích.
10. So khớp kích thước/checksum khi khả thi.
11. Chạy transaction cập nhật DB với điều kiện giá trị cũ chưa đổi.
12. Ghi `DB_UPDATED` vào manifest.

Nếu giá trị DB đã thay đổi bởi người dùng trong lúc migrate, không ghi đè; đánh dấu conflict để xử lý thủ công.

### Bước 5.4 — Idempotency và retry

- Chạy lại cùng `runId` không tạo object khác nếu item đã verified.
- Nếu target object tồn tại và checksum khớp, bỏ qua upload và tiếp tục update DB.
- Retry chỉ áp dụng lỗi mạng/5xx/timeouts, dùng exponential backoff có jitter.
- Không retry vô hạn với 401, 403, 404, MIME sai hoặc vượt kích thước.
- Ghi số lần thử và lỗi cuối cùng.

### Bước 5.5 — Batch và giới hạn tài nguyên

Giá trị khởi đầu an toàn:

- Batch DB: 50–100 bản ghi.
- Concurrency download/upload: 3–5.
- Timeout từng file: 15–30 giây.
- Giới hạn kích thước theo chính sách Phase 4.

Điều chỉnh sau khi đo CPU, memory, bandwidth và lỗi. Không chạy concurrency cao trực tiếp trên production.

## 8. Trình tự rollout theo nhóm dữ liệu

1. Một nhóm ảnh test không dùng trong production.
2. Banner/promotion số lượng nhỏ.
3. Ảnh món ăn public.
4. Ảnh nhà hàng public.
5. Avatar người dùng.
6. Tài liệu private, trong cửa sổ bảo trì và với kiểm soát chặt hơn.

Sau mỗi nhóm:

- So sánh số lượng source/target.
- Chọn mẫu ngẫu nhiên để kiểm tra hiển thị.
- Kiểm tra log 4xx/5xx.
- Xác nhận rollback manifest dùng được.
- Chờ một khoảng quan sát trước khi chuyển nhóm tiếp theo.

## 9. Kiểm thử

### Unit test script

- Phân loại domain/provider.
- Quy tắc quyền sử dụng.
- Sinh key ổn định.
- Chuyển trạng thái manifest hợp lệ.
- Retry classification.
- Conditional DB update chống ghi đè.

### Integration test

- File hợp lệ được upload, verify và cập nhật DB.
- File 404 được ghi lỗi, batch vẫn tiếp tục.
- MIME giả bị từ chối.
- Chạy lại không tạo bản sao.
- Object tồn tại/checksum khớp được reuse.
- DB conflict không ghi đè upload mới của người dùng.

### Kiểm thử ứng dụng

- API trả được cả ảnh URL ngoài và ảnh MinIO.
- Danh sách món ăn/nhà hàng không vỡ khi ảnh null.
- Presigned URL private không bị ghi vào DB hoặc cache lâu hơn thời hạn.
- Cache được invalidate khi tham chiếu ảnh đổi.

## 10. Đối soát sau migration

Tạo báo cáo:

- Tổng item discovered/eligible/skipped/failed/completed.
- Tổng bytes đã chuyển.
- Object thiếu hoặc checksum không khớp.
- Bản ghi DB trỏ đến object không tồn tại.
- Object orphan không có bản ghi DB.
- Danh sách nguồn ngoài chưa xác minh quyền.

Không xóa nguồn cũ ngay. Đặt thời gian quan sát, ví dụ 14–30 ngày, tùy khả năng lưu trữ và rủi ro.

## 11. Rollback

Rollback theo manifest theo thứ tự ngược:

1. Dừng migration worker.
2. Chuyển reader ưu tiên URL cũ nếu có feature flag.
3. Với mỗi item `DB_UPDATED`, dùng `previousDatabaseValue` và conditional update để khôi phục.
4. Kiểm tra API hiển thị dữ liệu cũ.
5. Chỉ xóa object MinIO sau khi hệ thống ổn định và danh sách object được xác minh.

Không rollback mù nếu người dùng đã upload ảnh mới sau migration. Những conflict này phải xử lý thủ công.

## 12. Deliverables

- [ ] Inventory tất cả trường ảnh/tài liệu.
- [ ] Bảng xác minh quyền sử dụng.
- [ ] ADR về schema tham chiếu storage.
- [ ] Database migration tương thích ngược nếu cần.
- [ ] Tool inventory, dry-run, migrate và rollback.
- [ ] Manifest có version.
- [ ] Test và báo cáo chạy staging.
- [ ] Báo cáo đối soát production.
- [ ] Danh sách URL ngoài giữ lại và lý do.

## 13. Điều kiện hoàn thành

- [ ] 100% item đủ điều kiện đã ở trạng thái `DB_UPDATED` hoặc có lỗi được chấp nhận bằng văn bản.
- [ ] Không có DB reference trỏ đến object MinIO bị thiếu.
- [ ] Các URL chưa migrate đều có lý do rõ ràng.
- [ ] Public/private access đúng chính sách.
- [ ] Tỷ lệ lỗi ảnh không tăng sau thời gian quan sát.
- [ ] Rollback đã được diễn tập trên staging.
- [ ] Nguồn cũ chưa bị xóa trước khi kết thúc thời gian an toàn.

