# Payments

Payments sở hữu thực thể `Checkout` (`src/entities/checkout.entity.ts`), quản lý giao dịch thanh toán qua cổng trung gian (VNPay, MoMo, COD), xử lý webhook, đối soát (reconciliation) và trạng thái thanh toán.

## Cấu trúc và vai trò

```text
payments/
├── contracts/
├── domain/
│   └── payment-status-machine.ts       # State machine chuyển đổi trạng thái thanh toán
├── dto/
│   ├── payment-request.dto.ts          # ProcessPaymentDto, MomoResultQueryDto, WebhookDto
│   └── payment-response.dto.ts
├── payment.controller.ts               # HTTP routes cho Customer & Public Webhooks
├── demo-payment.controller.ts          # Mock/sandbox endpoints cho môi trường dev
├── payment.service.ts                  # Nghiệp vụ xử lý checkout, webhook, kiểm tra chữ ký
├── payment-reconciliation.service.ts   # Tự động quét và đối soát các giao dịch treo/lỗi
├── payment.module.ts                   # Đăng ký TypeOrmModule.forFeature([Checkout])
└── public-api.ts                       # Export PaymentModule, PaymentService, contracts
```

## Danh sách Route HTTP

| Method | Route | Vai trò / Actor | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/payment/process/:checkoutId` | Customer (JWT) | Khởi tạo giao dịch thanh toán cho checkout đã tạo |
| `POST` | `/payment/cancel/:checkoutId` | Customer (JWT) | Hủy giao dịch thanh toán |
| `POST` | `/payment/webhook/:provider` | Public (Webhook) | Nhận IPN callback từ MoMo hoặc VNPay (kèm HMAC verify) |
| `GET` | `/payment/vnpay/return` | Public (Browser) | Xử lý redirect return URL từ cổng VNPay |
| `GET` | `/payment/momo/return` | Public (Browser) | Xử lý redirect return URL từ cổng MoMo |
| `POST` | `/payment/reconcile` | Admin / Cron | Kích hoạt chu trình đối soát giao dịch pending |
| `ALL` | `/payment-demo/*` | Dev / Demo | Sandbox mô phỏng thanh toán khi không có cổng thật |

## Ranh giới sở hữu và Giao tiếp

1. **Entity Ownership:**
   - Payments sở hữu độc quyền `Checkout`.
   - Tuyệt đối không inject `Order`, `Food`, `User`, `Promotion` repository (đã có test `payment.cross-feature-boundary.spec.ts` bảo vệ).
2. **Giao tiếp liên Feature:**
   - Khi thanh toán thành công, Payments phát sự kiện bất đồng bộ qua `EventsModule` (`payment.succeeded`, `payment.failed`).
   - Feature `orders` và `notifications` lắng nghe sự kiện để cập nhật trạng thái đơn hàng và gửi thông báo cho khách.
3. **Cổng thanh toán Hạ tầng:**
   - Tích hợp cổng thanh toán độc lập qua `src/infra/payment-gateways/public-api`.
