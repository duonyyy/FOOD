# Phase 9 — Checklist phát hành cuối cùng

## 1. Mục đích

Đây là cổng kiểm tra `Go/No-Go`, không phải danh sách để đánh dấu cho đủ. Mỗi mục quan trọng phải có bằng chứng như log CI, test report, migration report, dashboard hoặc ticket chấp nhận rủi ro.

Nếu một mục P0 chưa đạt, kết luận mặc định là `NO-GO`.

## 2. Thông tin release

Điền trước buổi Go/No-Go:

| Mục | Giá trị |
|---|---|
| Release version/tag | |
| Commit SHA / image digest | |
| Ngày giờ dự kiến | |
| Người điều phối | |
| Người chạy migration | |
| Người theo dõi hệ thống | |
| Người có quyền rollback | |
| Link changelog | |
| Link dashboard | |
| Link runbook | |
| Backup ID/time | |
| Rollback version | |

## 3. Cổng vào release

- [ ] Scope release đã được đóng băng.
- [ ] Mọi thay đổi trong release có issue/PR và người review.
- [ ] Không còn bug P0/P1 chưa có quyết định chấp nhận rủi ro.
- [ ] Image/artifact đã build một lần và có immutable tag/digest.
- [ ] Chính artifact đó đã chạy trên staging.
- [ ] Changelog ghi rõ API/schema/config thay đổi.
- [ ] Feature flags có giá trị mặc định và owner.
- [ ] Có cửa sổ deploy phù hợp, tránh thời điểm tải cao nếu release rủi ro.
- [ ] Người thực hiện và người rollback đều sẵn sàng.

## 4. Kiểm tra source và chất lượng code

Chạy trên clean checkout của đúng commit release:

```powershell
npm ci
npm run build
npm run lint -- --no-fix
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run migration:show
docker compose config
```

Lưu ý: script `lint` hiện có `--fix` trong `package.json`. Trước khi dùng làm CI gate, nên tách thêm `lint:check` không sửa file; lệnh `--no-fix` ở trên cần được xác nhận hoạt động với cấu hình ESLint hiện tại.

Checklist:

- [ ] Lockfile không bị thay đổi ngoài chủ đích.
- [ ] Build pass.
- [ ] Lint check pass và không tự sửa source trong CI.
- [ ] Unit test pass.
- [ ] Integration/E2E test pass.
- [ ] Không có test `.only`, test bị bỏ qua không có lý do hoặc mock che mất luồng chính.
- [ ] Không có TypeScript error bị bỏ qua bằng `any`/disable rule không có giải thích.
- [ ] Dependency mới đã được review license và rủi ro bảo mật.
- [ ] Secret scan không phát hiện credential.

Ghi bằng chứng:

```text
CI run URL:
Build duration:
Unit tests: passed / total
E2E tests: passed / total
Known skipped tests:
```

## 5. Cấu hình và secret

- [ ] `NODE_ENV=production`.
- [ ] Không dùng password/secret mặc định từ local Compose.
- [ ] JWT access và refresh secret khác nhau nếu thiết kế yêu cầu.
- [ ] Database/Redis/MinIO/payment/mail credential lấy từ secret manager hoặc cơ chế bảo mật tương đương.
- [ ] CORS chỉ cho phép origin dự kiến.
- [ ] Base URL, callback URL và webhook URL đúng production.
- [ ] Swagger/debug/seed endpoint được tắt hoặc bảo vệ.
- [ ] Mail config đầy đủ hoặc tính năng mail được tắt có chủ đích.
- [ ] Secret không xuất hiện trong startup log.
- [ ] Có quy trình rotation cho secret quan trọng.

## 6. Database và migration

### Trước deploy

- [ ] `migration:show` xác nhận trạng thái expected.
- [ ] Migration đã chạy thành công trên database staging tương tự production.
- [ ] Review SQL lock, table scan và thời gian dự kiến.
- [ ] Migration tương thích với phiên bản app cũ trong rolling deploy.
- [ ] Backfill lớn chạy theo batch, không khóa request dài.
- [ ] Backup production hoàn thành và kiểm tra được.
- [ ] Biết chính xác RPO/RTO của release.
- [ ] Có query đối soát sau migration.

### Sau migration

- [ ] Migration job chỉ chạy một lần và exit 0.
- [ ] Schema version đúng.
- [ ] Không có migration pending ngoài dự kiến.
- [ ] Row counts/constraints/indexes quan trọng đúng.
- [ ] API phiên bản cũ/mới không lỗi schema trong thời gian rolling.
- [ ] Không có lock/slow query bất thường.

Không dùng `migration:revert` tự động cho migration làm mất dữ liệu. Nếu rollback app nhưng schema tương thích, giữ schema mới và xử lý cleanup ở release sau.

## 7. Authentication và authorization

- [ ] Đăng ký/đăng nhập email hoạt động theo contract.
- [ ] Google/Firebase login chỉ hoạt động nếu token được server xác minh đúng audience/issuer.
- [ ] Password sai không làm lộ tài khoản có tồn tại hay không ngoài policy đã chọn.
- [ ] OTP/reset token có TTL, one-time use và rate limit.
- [ ] Access token hết hạn bị từ chối.
- [ ] Refresh token rotation/revocation hoạt động theo thiết kế.
- [ ] Logout/revoke không để token tiếp tục dùng ngoài phạm vi đã ghi.
- [ ] Route cần auth trả 401 khi thiếu token.
- [ ] Route sai role trả 403.
- [ ] User không đọc/sửa tài nguyên của user khác bằng cách đổi ID.
- [ ] Login/OTP/reset có rate limiting và audit phù hợp.

Tài khoản test tối thiểu:

- Customer.
- Restaurant owner/staff nếu có.
- Shipper.
- Admin.
- Tài khoản disabled/locked.

## 8. API smoke test

Chạy trên staging và sau deploy production với dữ liệu kiểm soát:

- [ ] `GET /` hoặc route root trả trạng thái dự kiến.
- [ ] Swagger `/api` chỉ truy cập được theo chính sách môi trường.
- [ ] `/categories` trả dữ liệu.
- [ ] `/restaurants/all` trả dữ liệu.
- [ ] `/restaurants/popular` trả dữ liệu.
- [ ] `/foods/top-selling` trả dữ liệu.
- [ ] Route protected như `/foods/all` từ chối request thiếu auth theo contract.
- [ ] Pagination/filter/sort route chính không trả lỗi.
- [ ] Validation trả 400 với payload sai, không trả 500.
- [ ] Error response có request/correlation ID.

Không dùng smoke test production để tạo hàng loạt user/order thật. Dùng tài khoản và dữ liệu test được đánh dấu, sau đó cleanup an toàn.

## 9. MinIO và file storage

- [ ] Storage driver trỏ đúng môi trường.
- [ ] Public bucket chỉ cho anonymous read, không upload/delete.
- [ ] Private bucket không đọc anonymous được.
- [ ] Upload ảnh public hợp lệ thành công.
- [ ] File sai MIME/quá lớn bị chặn.
- [ ] Upload private thành công và chỉ actor có quyền lấy được presigned URL.
- [ ] Presigned URL hết hạn đúng.
- [ ] Thay ảnh không làm mất ảnh cũ nếu DB update thất bại.
- [ ] Migration manifest đã được lưu và backup.
- [ ] Không có DB reference trỏ object thiếu.
- [ ] Các URL ngoài chưa migrate có lý do/quyền sử dụng được ghi lại.
- [ ] Object storage backup/replication và dung lượng đã được kiểm tra.

## 10. Order và payment

- [ ] Backend tự tính giá từ database.
- [ ] Client sửa `unitPrice`/`totalAmount` không ảnh hưởng số tiền backend.
- [ ] Món khác nhà hàng hoặc ngừng bán bị từ chối.
- [ ] Promotion hết hạn/sai điều kiện/quá quota bị từ chối.
- [ ] Transaction rollback đúng khi một bước tạo order lỗi.
- [ ] Hai request cùng `Idempotency-Key` chỉ tạo một order.
- [ ] Cùng key nhưng payload khác trả conflict.
- [ ] Duplicate payment webhook không ghi nhận hai lần.
- [ ] Webhook sai chữ ký bị từ chối và có metric/audit.
- [ ] State transition không hợp lệ bị chặn.
- [ ] Customer/restaurant/shipper chỉ thao tác order đúng quyền.
- [ ] Outbox/notification lỗi không làm mất order đã commit.
- [ ] Có query/dashboard tìm order/payment mắc kẹt.

## 11. Chatbot

- [ ] General chat, order flow và quick reorder được route đúng.
- [ ] Mỗi conversation step có transition test.
- [ ] Structured output của LLM được schema validate.
- [ ] Prompt injection không thể gọi action ngoài whitelist.
- [ ] Chat không dùng giá do model/client tự tạo.
- [ ] Bản review hiển thị đủ món, giá, phí, giảm giá, tổng và địa chỉ.
- [ ] Chỉ xác nhận cuối mới tạo order.
- [ ] Hai lần xác nhận không tạo trùng đơn.
- [ ] Quick reorder tính lại giá và kiểm tra món/khuyến mãi/địa chỉ.
- [ ] Session có TTL và hoạt động khi API restart/multiple instance theo thiết kế.
- [ ] LLM timeout/quota lỗi có fallback không gây 500 không kiểm soát.
- [ ] Metric latency, parser error, fallback và conversion có dữ liệu.

## 12. Bảo mật vận hành

- [ ] HTTPS được bắt buộc.
- [ ] Security headers và proxy config đúng.
- [ ] Request body/upload limits hoạt động.
- [ ] Log đã redact Authorization, cookie, OTP, password và dữ liệu giấy tờ.
- [ ] SQL injection/mass assignment/IDOR ở route trọng yếu đã được test.
- [ ] Dependency scan không còn critical issue chưa xử lý.
- [ ] Admin action quan trọng có audit.
- [ ] Bucket, database và dashboard không mở public ngoài chủ đích.
- [ ] Tài khoản service dùng least privilege.

## 13. Observability và khả năng phục hồi

- [ ] `/health/live` hoạt động và không phụ thuộc external service không cần thiết.
- [ ] `/health/ready` fail khi DB/dependency bắt buộc không sẵn sàng.
- [ ] Log có request ID/trace ID.
- [ ] Dashboard request rate/error/latency/saturation hoạt động.
- [ ] Dashboard order/payment/storage/chat hoạt động.
- [ ] Alert test đã đến đúng người/kênh.
- [ ] Runbook gắn với alert.
- [ ] Graceful shutdown đã kiểm tra.
- [ ] Database restore đã diễn tập gần đây.
- [ ] Object storage restore/read test thành công.
- [ ] Rollback deployment đã diễn tập trên staging.

## 14. Kiểm tra hiệu năng tối thiểu

- [ ] Có baseline p50/p95/p99 trước release.
- [ ] Route danh sách phổ biến đạt ngưỡng latency đã thống nhất.
- [ ] Tạo order dưới tải dự kiến không trùng/sai dữ liệu.
- [ ] DB pool không cạn ở mức tải mục tiêu.
- [ ] Redis/queue/outbox không backlog tăng mãi.
- [ ] Upload file gần giới hạn không làm memory tăng mất kiểm soát.
- [ ] LLM timeout không giữ request lâu hơn timeout budget.

Không đặt ngưỡng tùy ý chỉ để pass. Ngưỡng phải dựa trên nhu cầu sản phẩm và năng lực hạ tầng đã đo.

## 15. Kế hoạch deploy

1. Thông báo bắt đầu release.
2. Xác nhận backup và artifact digest.
3. Chạy migration/release job.
4. Deploy canary hoặc replica đầu tiên.
5. Chạy health và smoke tests.
6. Theo dõi 5xx, latency, DB, order/payment trong khoảng quan sát.
7. Mở rộng rolling deploy.
8. Chạy lại smoke tests.
9. Theo dõi business metrics sau release.
10. Công bố hoàn tất hoặc kích hoạt rollback.

Ghi timeline thực tế:

```text
Deploy start:
Migration complete:
Canary ready:
Smoke test complete:
Full rollout:
Observation complete:
Release closed:
```

## 16. Điều kiện rollback

Rollback ngay hoặc dừng rollout nếu:

- Tăng 5xx nghiêm trọng so với baseline.
- Login diện rộng không hoạt động.
- Có dấu hiệu mất/rò dữ liệu.
- Tạo trùng order, sai tổng tiền hoặc payment state sai.
- Migration gây lock/CPU/latency vượt ngưỡng an toàn.
- Upload/read private file sai quyền.
- Không thể quan sát hệ thống để đánh giá an toàn.

Quy trình:

1. Dừng mở rộng rollout/traffic vào phiên bản lỗi.
2. Ghi thời điểm và phạm vi ảnh hưởng.
3. Chuyển traffic về image digest trước.
4. Không tự revert schema phá hủy dữ liệu.
5. Tắt feature flag liên quan nếu nhanh và an toàn hơn.
6. Đối soát order/payment/data đã phát sinh trong khoảng lỗi.
7. Xác nhận metric hồi phục.
8. Mở incident review, không deploy lại cùng bản khi chưa hiểu nguyên nhân.

## 17. Quyết định Go/No-Go

### P0 — Phải đạt

- [ ] Không có rủi ro mất/rò dữ liệu chưa kiểm soát.
- [ ] Auth/authorization route chính pass.
- [ ] Order/payment tính đúng và idempotent.
- [ ] Backup + rollback khả dụng.
- [ ] Health/log/metric đủ để phát hiện sự cố.
- [ ] Migration đã được kiểm chứng.

### Rủi ro được chấp nhận

| Rủi ro | Ảnh hưởng | Biện pháp giảm thiểu | Owner | Deadline |
|---|---|---|---|---|
| | | | | |

### Ký xác nhận

```text
Decision: GO / NO-GO
Technical owner:
Product/business owner:
Operations owner:
Decision time:
Notes:
```

## 18. Sau release

Trong 24–72 giờ tùy mức rủi ro:

- [ ] Theo dõi error/latency và resource.
- [ ] Đối soát order/payment.
- [ ] Kiểm tra upload/read object.
- [ ] Theo dõi login failure/OTP abuse.
- [ ] Theo dõi chatbot fallback/drop-off.
- [ ] Xử lý object orphan hoặc dữ liệu test theo quy trình an toàn.
- [ ] Ghi incident/near-miss.
- [ ] Cập nhật runbook và roadmap dựa trên dữ liệu thực tế.
- [ ] Chỉ cleanup schema/storage cũ ở release riêng sau thời gian quan sát.

Phase 9 hoàn thành khi release đã qua thời gian quan sát, không còn incident P0/P1 chưa xử lý và báo cáo release được lưu đầy đủ.

