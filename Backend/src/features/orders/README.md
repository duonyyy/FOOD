# Orders

Orders sở hữu `Order`, `OrderDetail`, cách tính giá và toàn bộ thay đổi `Order.status`.

## Cấu trúc hiện tại

```text
orders/
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
└── public-api.ts
```

Feature chỉ có một Nest module và một public API. Feature khác chỉ được import
`src/features/orders/public-api`; không deep import service, type, DTO hoặc module nội bộ.

## Trách nhiệm service

| Service | Trách nhiệm |
|---|---|
| `PublicOrdersService` | Đọc Order/chi tiết và lọc dữ liệu nhạy cảm |
| `CustomerOrdersService` | Điều phối use case của customer |
| `MerchantOrdersService` | Danh sách và thay đổi trạng thái của merchant |
| `AdminOrdersService` | Truy vấn quản trị, timeout và thay đổi trạng thái của admin/event |
| `OrderCreationService` | Tính giá và tạo Order trong transaction |
| `OrderRulesService` | State machine, pricing, quyền truy cập, điều kiện review/messaging |
| `OrderDeliveryService` | Phần Order mà Delivery cần; không sở hữu chuyến giao |
| `OrderAnalyticsService` | Dữ liệu Order tối thiểu cho Analytics |
| `OrderMessagingService` | Use case Order dành cho Chat/Messenger |
| `order-events.handler.ts` | Nhận event Payment/Delivery và gọi owner Orders |

## Boundary đã chốt

- Không dùng `forwardRef()`.
- Orders không import Delivery, Reviews, Analytics, Notifications hoặc Communications.
- Delivery, Reviews, Analytics và Communications chỉ dùng public API chính của Orders.
- Delivery sở hữu `ShippingDetail`, pending assignment, shipper và trạng thái giao hàng.
- Reviews sở hữu review và review summary.
- Payments sở hữu checkout/gateway. Route payment tương thích của Orders delegate sang
  `PaymentService`, không xử lý thẻ hoặc gateway trong Orders.
- Locations sở hữu Address và cron xóa địa chỉ tạm. Orders chỉ gọi `AddressService` qua public API.
- `ORDER_STATUS_CHANGED_EVENT` dùng Outbox cho luồng cần retry sau commit.

Entity vẫn ở `src/entities` theo quyết định hiện tại; đợt refactor này không đổi schema hoặc migration.
