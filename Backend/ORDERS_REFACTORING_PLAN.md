# Kế hoạch hoàn thiện feature Orders

Ngày cập nhật: 2026-09-23

## Kết luận

Kế hoạch refactor cấu trúc Orders đã được triển khai. Code hiện tại dùng cấu trúc role-based, một
module chính và một public API. Các tên `Reader`, `Command`, `Adapter`, `Core`, `Facade` đã được bỏ
khỏi public surface của Orders.

Không chuyển entity trong đợt này. Entity vẫn ở `src/entities`; đây là quyết định có chủ đích để
không trộn refactor module với schema/migration.

## Cấu trúc đã đạt

```text
src/features/orders/
├── controllers/
│   ├── public-orders.controller.ts
│   ├── customer-orders.controller.ts
│   ├── merchant-orders.controller.ts
│   ├── admin-orders.controller.ts
│   └── order.resolver.ts
├── services/
│   ├── public-orders.service.ts
│   ├── customer-orders.service.ts
│   ├── merchant-orders.service.ts
│   ├── admin-orders.service.ts
│   ├── order-creation.service.ts
│   ├── order-rules.service.ts
│   ├── order-delivery.service.ts
│   ├── order-analytics.service.ts
│   ├── order-messaging.service.ts
│   └── order-events.handler.ts
├── dto/
├── types/
├── contracts/
├── orders.module.ts
├── public-api.ts
└── README.md
```

## Các nhịp đã hoàn thành

| Nhịp | Kết quả |
|---|---|
| Orders–Reviews | Review summary thuộc Reviews; Orders chỉ cung cấp rule/context |
| Analytics | Dùng `OrderAnalyticsService` qua public API chính; xóa module/API reader riêng |
| Internal services | Tách creation, rules, public, messaging và role services; xóa facade `OrderService` |
| Address ownership | Cron và vòng đời địa chỉ tạm chuyển về Locations |
| Payment ownership | Route tương thích của Orders delegate sang checkout của Payments |
| Delivery boundary | Gộp API phía Order vào `OrderDeliveryService`; xóa reader/command module phụ |
| Public contract | Feature khác chỉ import `src/features/orders/public-api` |

## Quy tắc cố định sau refactor

- Không `forwardRef()`.
- Không deep import giữa các feature.
- Không thêm lại port chỉ để bọc một concrete service đang cùng process.
- Orders là nơi duy nhất thay đổi `Order.status`.
- Delivery không dùng Order repository/entity và không sở hữu `Order.status`.
- Orders không sở hữu queue, pending assignment, review, checkout, gateway hoặc Address lifecycle.
- Event/Outbox vẫn được giữ cho luồng cần durability và retry.
- Không đổi route, response, GraphQL hoặc database schema nếu chưa có test migration riêng.

## Exit gate

- [x] Một `orders.module.ts` và một `public-api.ts`.
- [x] Đúng 10 file service đã thống nhất.
- [x] Không `forwardRef()`.
- [x] Không deep import chéo feature vào Orders internals.
- [x] Không public class/file Orders mang tên Reader, Command, Adapter, Core hoặc Facade.
- [x] Orders không import Delivery/Reviews/Analytics/Notifications/Communications.
- [x] Address cleanup thuộc Locations.
- [x] Checkout/gateway thuộc Payments.
- [x] README, dependency graph và boundary tests đã đổi theo cấu trúc mới.
- [x] Build, scoped lint, unit, integration và E2E liên quan xanh ở lần chạy cuối.
- [x] Chỉ stage file thuộc refactor; không stage Docker hoặc thư mục reference của người dùng.

## Việc tiếp theo sau khi Orders được push

Không tiếp tục tách nhỏ Orders chỉ vì số dòng. `OrderCreationService` dài nhưng đang chứa một
transaction tạo Order có liên kết chặt; tách tiếp chỉ khi có trách nhiệm độc lập và test tương ứng.

Bước nhỏ nhất tiếp theo là chọn một feature khác có boundary rõ, lập inventory trước, rồi áp dụng
cùng exit gate. Không mở microservice/monorepo hoặc di chuyển entity hàng loạt.
