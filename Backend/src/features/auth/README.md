# Auth

Auth sở hữu nghiệp vụ xác thực người dùng, sinh/kiểm tra JSON Web Token (JWT), OTP qua email/SMS, đăng nhập mạng xã hội (Google OAuth) và cung cấp các Guard phân quyền (`AuthGuard`, `RolesGuard`, `WebSocketAuthGuard`) cho toàn bộ hệ thống.

## Cấu trúc và vai trò

```text
auth/
├── contracts/
│   └── graphql-subscription-context.ts # Context xác thực kết nối WebSocket GraphQL
├── decorators/
│   └── permissions.decorator.ts        # @Permissions(...rules)
├── dto/                                # Register, Login, Driver, OTP, Password Reset DTOs
├── guards/
│   ├── auth.guard.ts                   # Xác thực Bearer JWT cho HTTP
│   ├── roles.guard.ts                  # Kiểm tra Permission từ token cho HTTP
│   └── websocket-auth.guard.ts         # Xác thực kết nối WebSocket
├── interfaces/
│   └── authenticated-request.interface.ts # Re-export từ src/shared/types/auth
├── services/
│   ├── otp.service.ts                  # Tạo và xác thực mã OTP
│   ├── password-reset.service.ts       # Luồng quên mật khẩu và đổi mật khẩu
│   └── social-auth.service.ts          # Xác thực tài khoản Google
├── auth.controller.ts                  # Toàn bộ API endpoint xác thực `/auth/*`
├── auth.service.ts                     # Điều phối đăng nhập, cấp phát access/refresh token
├── auth.module.ts                      # Module chính của feature
├── auth-module.public-api.ts           # Export runtime AuthModule hẹp (tránh vòng lặp DI)
└── public-api.ts                       # Export Guards, Decorators, và Types công khai
```

## Danh sách Route HTTP (`/auth`)

| Method | Route | Mô tả |
| :--- | :--- | :--- |
| `POST` | `/auth/register` | Đăng ký tài khoản khách hàng mới |
| `POST` | `/auth/login` | Đăng nhập bằng Email và Password |
| `POST` | `/auth/login-driver` | Đăng nhập dành riêng cho Tài xế (Shipper) |
| `POST` | `/auth/register-driver` | Đăng ký hồ sơ làm Tài xế (gọi ShipperProfileModule) |
| `POST` | `/auth/google/register` | Đăng ký / Đăng nhập nhanh qua Google OAuth |
| `POST` | `/auth/verify-otp` | Xác thực tài khoản bằng mã OTP đã gửi qua Mail |
| `POST` | `/auth/resend-otp` | Gửi lại mã OTP mới |
| `POST` | `/auth/forgot-password` | Yêu cầu gửi link đặt lại mật khẩu |
| `POST` | `/auth/reset-password` | Đặt mật khẩu mới với token xác nhận |
| `POST` | `/auth/refresh-token` | Cấp mới Access Token bằng Refresh Token |
| `POST` | `/auth/logout` | Đăng xuất và thu hồi Refresh Token |

## Ranh giới Dependency & Thiết kế tránh Vòng lặp (DI Graph)

```text
IdentityModule (Users) ────► AuthModule ────► ShipperProfileModule (Delivery)
     │                           ▲                      │
     └───────────────────────────┴──────────────────────┘
```

1. **Hai bề mặt Public API:**
   - [`public-api.ts`](src/features/auth/public-api.ts): Các feature khác import Guards (`AuthGuard`, `RolesGuard`) và Decorators mà **không cần kéo runtime module `AuthModule`** vào.
   - [`auth-module.public-api.ts`](src/features/auth/auth-module.public-api.ts): Chỉ export runtime `AuthModule` cho những feature thực sự cần (IdentityModule, DeliveryModule).
2. **Ngăn chặn vòng lặp phụ thuộc (Zero Circular Dependency):**
   - `AuthModule` nhập `ShipperProfileModule` (module hồ sơ hẹp của Delivery) để tạo hồ sơ shipper khi đăng ký.
   - `AuthModule` **tuyệt đối không nhập** `DeliveryModule` đầy đủ.
   - `ShipperProfileModule` **tuyệt đối không nhập** `AuthModule`.
   - Mọi quy tắc này đều được bảo vệ tự động bằng bài test [`feature-ownership-boundaries.spec.ts`](../../../test/integration/feature-ownership-boundaries.spec.ts).
