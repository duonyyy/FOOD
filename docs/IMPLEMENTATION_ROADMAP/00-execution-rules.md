# Phase 0 — Quy Tắc Thực Hiện Roadmap

## Mục tiêu

Đảm bảo mọi phase được triển khai theo cùng một quy trình: có baseline, thay đổi nhỏ, test được, rollback được và không làm mất dữ liệu của người dùng.

## 1. Quy trình cho mỗi task

1. Đọc code và xác định flow hiện tại.
2. Ghi input/output và invariant cần giữ.
3. Viết hoặc bổ sung test bảo vệ hành vi hiện tại.
4. Thực hiện thay đổi nhỏ nhất đủ đạt mục tiêu.
5. Chạy build, test liên quan và smoke test API.
6. Kiểm tra migration hoặc thay đổi cấu hình bằng môi trường Docker local.
7. Ghi rollback plan trong PR.
8. Merge khi test và acceptance criteria đều pass.

## 2. Definition of Ready

Một task chỉ bắt đầu khi có đủ:

- [ ] Mục tiêu và lý do thay đổi.
- [ ] Module/file nằm trong phạm vi.
- [ ] API hoặc dữ liệu bị ảnh hưởng.
- [ ] Test case thành công và thất bại.
- [ ] Rủi ro dữ liệu/security.
- [ ] Cách rollback.

## 3. Definition of Done

Một task chỉ được đánh dấu xong khi:

- [ ] Code build pass.
- [ ] Test liên quan pass.
- [ ] Không làm hỏng API cũ ngoài thay đổi đã document.
- [ ] Không log secret/token/password/OTP.
- [ ] Có cập nhật `.env.example` nếu thêm biến môi trường.
- [ ] Có cập nhật Swagger/README nếu thay public API.
- [ ] Có rollback instruction.

## 4. Quy tắc migration database

- Không sửa nội dung migration đã chạy trên database dùng chung.
- Mọi thay đổi schema tạo migration mới.
- Luôn chạy `migration:show` trước và sau khi migrate.
- Migration phải được thử trên bản sao/snapshot trước dữ liệu quan trọng.
- Migration destructive phải có backup và rollback script riêng.
- Seed data không được trộn với migration schema mới nếu có thể tách riêng.

## 5. Quy tắc file/object migration

- Script migration phải hỗ trợ `--dry-run`.
- Không update DB trước khi object mới upload và đọc lại thành công.
- Mỗi record phải có trạng thái: `pending`, `migrated`, `skipped`, `failed`.
- Lưu manifest gồm ID record, URL cũ, object key mới, checksum và lỗi.
- Script phải idempotent: chạy lại không tạo object trùng.

## 6. Quy tắc bảo vệ worktree

- Không dùng `git reset --hard` hoặc xóa thay đổi không liên quan.
- Không format toàn repository trong PR nghiệp vụ.
- Không đổi line ending hàng loạt.
- Mỗi PR ghi rõ file do task thay đổi và file user đã sửa sẵn cần giữ nguyên.

## 7. Bằng chứng cần lưu

Tùy task, lưu ít nhất một trong các loại sau:

- Output `npm run build` và test.
- HTTP status/body smoke test.
- Docker Compose `ps` và healthcheck.
- Migration output và row count trước/sau.
- MinIO object listing và presigned URL test.
- Log event có request ID nhưng không chứa dữ liệu nhạy cảm.

## Exit criteria

- Team/người làm hiểu và sử dụng cùng Definition of Done.
- Không phase nào được phép bỏ qua backup, test hoặc rollback chỉ để chạy nhanh.

