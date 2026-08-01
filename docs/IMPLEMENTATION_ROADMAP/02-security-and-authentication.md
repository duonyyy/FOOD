# Phase 2 — Security và Authentication

## Mục tiêu

Làm rõ phương thức đăng nhập, bảo vệ token/secret và ngăn brute force trước khi mở rộng tính năng.

## Bước 1 — Secret và config validation

- [ ] Thay JWT secret mẫu bằng secret mạnh ở từng môi trường.
- [ ] Đảm bảo `.env` không được commit; tạo `.env.example` không chứa secret thật.
- [ ] Validate biến bắt buộc lúc startup: JWT, DB, Redis, Firebase, mail và payment.
- [ ] Chia biến bắt buộc và optional; mail optional local không được làm app crash.
- [ ] Xóa mọi log có thể lộ credential hoặc payload nhạy cảm.

## Bước 2 — Email/password login

- [ ] Tạo `LoginDto` với `IsEmail`, `IsString`, min/max length.
- [ ] Không nhận email/password bằng `@Body('...')` rời.
- [ ] Trả cùng một lỗi cho email không tồn tại và password sai.
- [ ] Kiểm tra `isActive` trước cấp token.
- [ ] Thêm rate limit theo IP + normalized email.
- [ ] Không log password hoặc raw body login.

## Bước 3 — Google/Firebase

- [ ] Verify Firebase ID token ở backend.
- [ ] Chỉ lấy email, uid, name từ decoded token đã verify.
- [ ] Quy định account linking khi email đã có tài khoản password.
- [ ] Đổi/document endpoint `register/google` thành login-or-register.
- [ ] Không coi enum Facebook là tính năng đã triển khai.

## Bước 4 — OTP và password reset

- [ ] Chốt OTP là verify phone hay phone login.
- [ ] Giữ TTL, giới hạn gửi và giới hạn verify trong Redis.
- [ ] Hash OTP; không lưu OTP plaintext.
- [ ] Reset token là single-use, có TTL và bị vô hiệu sau đổi password.
- [ ] Nếu mail chưa cấu hình, trả lỗi service unavailable rõ ràng cho reset flow.

## Bước 5 — Token lifecycle

- [ ] Access token ngắn hạn và thống nhất payload: `sub`, `role`, `roleId`.
- [ ] Refresh token được hash khi lưu server-side.
- [ ] Rotate refresh token mỗi lần refresh.
- [ ] Logout revoke refresh token/session.
- [ ] Guard HTTP và WebSocket dùng cùng token utility và error semantics.

## Bước 6 — Authorization module

- [ ] `AuthGuard` và `RolesGuard` được đăng ký/export từ một module dùng chung.
- [ ] Module dùng guard phải import module cung cấp guard; không tự tạo `JwtService` rải rác.
- [ ] Permission check dùng permission constant/enum, tránh chuỗi tự do không kiểm soát.
- [ ] Test route không permission, thiếu token, token hợp lệ nhưng thiếu quyền.

## Public API dự kiến

- Giữ `POST /auth/login/email`.
- Google endpoint được document là login-or-register; alias endpoint cũ trong thời gian chuyển đổi nếu đổi tên.
- Nếu triển khai refresh: thêm `POST /auth/refresh`.
- Logout nhận refresh token/session identity và revoke phía server.
- Phone login chỉ được công bố nếu verify OTP thực sự cấp token.

## Test bắt buộc

- Login đúng/sai password, email không tồn tại, user inactive.
- JWT thiếu, sai chữ ký, hết hạn.
- Google token sai, thiếu email, account linking conflict.
- OTP hết hạn, quá số lần gửi/verify.
- Refresh rotation và replay token cũ.
- Role/permission denied và allowed.

## Rollout

1. Thêm DTO/test mà chưa đổi response.
2. Thêm token/session model và endpoint refresh.
3. Frontend chuyển sang refresh flow.
4. Sau compatibility window mới bỏ endpoint/field cũ.

## Exit criteria

- Không còn secret mẫu ở deploy.
- Login và refresh có test đầy đủ.
- Logout có hiệu lực phía server nếu refresh token được triển khai.
- Guard dependency không làm API crash khi khởi động.

