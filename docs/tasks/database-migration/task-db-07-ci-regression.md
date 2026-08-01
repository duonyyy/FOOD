# Task DB-07: Thêm regression test migration vào CI/deployment

## Mục tiêu

Phát hiện sớm trường hợp image build thành công nhưng database rỗng hoặc API khởi động trước migration.

## Pipeline đề xuất

```text
PostgreSQL rỗng
        ↓
Build production image
        ↓
Run compiled migrations
        ↓
Verify migration history và schema
        ↓
Start API
        ↓
Test restaurants / foods / promotions
        ↓
Test MinIO health + upload/read/delete
```

## Công việc chi tiết

1. Khởi tạo PostgreSQL database disposable trong CI.
2. Build image bằng đúng Dockerfile production.
3. Chạy compiled migration runner.
4. Assert runner exit code 0.
5. Assert không còn migration pending.
6. Assert các bảng `restaurants`, `foods`, `promotions` tồn tại.
7. Start API sau migration.
8. Gọi ba endpoint đọc dữ liệu và assert status/response contract.
9. Kiểm tra MinIO health, upload/read/delete để bảo vệ task MinIO đã nghiệm thu.
10. Chạy migration lần thứ hai để kiểm tra idempotency.

## Tiêu chí nghiệm thu

- CI fail nếu migration compiled không chạy được.
- CI fail nếu API start trước migration.
- CI fail nếu bất kỳ API đọc nào trả lỗi thiếu relation.
- CI fail nếu migration chạy lại tạo bản ghi/schema trùng.
- CI vẫn kiểm tra regression của MinIO.
- Log CI hiển thị rõ bước nào fail: build, migration, schema, API hoặc object storage.

## Rủi ro cần kiểm tra

- Test chỉ gọi `/` không đủ để phát hiện schema thiếu; phải gọi trực tiếp các endpoint đang lỗi.
- Test trên database dùng lại giữa các job có thể che giấu migration thiếu; nên dùng database/volume disposable.
- Test chỉ kiểm HTTP 200 chưa đủ nếu response rỗng do seed không chạy; nên có assertion ở database hoặc fixture rõ ràng.
