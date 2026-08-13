# Phase 3 — P3.1 handoff và characterization

Date: 2026-08-13

## Gate note

Phase 2 functional acceptance đã PASS. Tài liệu Phase 2 vẫn giữ trạng thái
`IN_PROGRESS` vì repository-wide format/lint legacy baseline chưa được reviewer
chấp thuận. P3.1 được thực hiện như handoff/characterization để không mất tiến
độ; chưa mở state-machine refactor trước khi gate này được quyết định.

## Contracts đã nhận từ Phase 2

- Catalog cung cấp `MENU_READER.getOrderableItems()` và trả plain immutable
  `OrderableItemSnapshot`, không trả TypeORM Food entity.
- Snapshot gồm `foodId`, `restaurantId`, `name`, `unitPrice`, `status`,
  `isAvailable` và topping snapshots.
- Merchant cung cấp `MERCHANT_CATALOG` với `findRestaurant()` và
  `assertCanManageRestaurant()`.
- Locations cung cấp `LOCATION_READER` với address snapshot và temporary
  address snapshot.
- Order không được sở hữu PaymentTransaction hoặc ShippingDetail lifecycle.

## Characterization command

```text
npx jest --runInBand --no-cache --cacheDirectory=.tmp/jest \
  src/modules/order/order.authorization.spec.ts \
  src/modules/order/order.pricing-state.spec.ts \
  src/modules/order/payment-succeeded-order.handler.spec.ts \
  src/payment/payment.idempotency.spec.ts \
  src/modules/food/food.authorization.spec.ts \
  src/features/menu/orderable/menu-reader.service.spec.ts
```

Result: **6 suites / 23 tests PASS**.

## OrderService public surface và callers

### Commands/mutations

- `createOrder()` — `OrderController`, Chat flows.
- `updateOrderStatus()` — `OrderController`, payment-succeeded handler.
- `confirmOrder()` — restaurant workflow.
- `deleteOrder()` — customer/admin controller paths.
- `processPayment()` và `confirmPayment()` — payment/order paths.
- `createTemporaryAddress()`, `deleteTemporaryAddress()` và cleanup jobs.
- `autoCancelStuckOrders()` và `autoCancelUnassignedOrders()` — scheduled/order
  workflows.

### Queries/calculation

- `getOrderById()`, `getOrderDetails()`, `getAllOrders()`.
- `getOrdersByUser()`, `getOrdersByRestaurant()`, `getOrderHistory()`.
- `getMinimalOrderHistoryForQuickReorder()` — Chat quick reorder.
- `calculateOrder()` và `calculateOrderWithCustomAddress()`.
- `validatePromotionForOrder()`.

### Direct callers cần compatibility

1. `src/modules/order/order.controller.ts` — HTTP create, query, status,
   payment và promotion routes.
2. `src/modules/chat/flows/quick-reorder-flow.service.ts` — history và create.
3. `src/modules/chat/flows/order-conversation-flow.service.ts` — create order.
4. `src/modules/chat/services/chat-context.service.ts` — order history.
5. `src/modules/order/payment-succeeded-order.handler.ts` — status update.
6. `src/modules/order/order.module.ts` — provider/export hiện tại.

Compatibility facade hiện phải giữ tại
`src/modules/order/order.service.ts` cho tới khi các caller migrate sang
Ordering feature services.

## Current status vocabulary

Entity hiện dùng raw string gồm:

`pending`, `confirmed`, `delivering`, `shipper_received`, `completed`,
`canceled`, `processing_payment`.

Characterization cho thấy transition map hiện tại trong `updateOrderStatus()`:

| Current | Allowed next states |
|---|---|
| `pending` | `confirmed`, `canceled` |
| `confirmed` | `shipper_received`, `delivering`, `canceled` |
| `shipper_received` | `delivering`, `canceled` |
| `delivering` | `completed`, `canceled` |
| `processing_payment` | `pending`, `canceled` |
| `completed` | terminal |
| `canceled` | terminal |

### Risks to address in T5.1

- Status values chưa có domain enum/value object dùng chung.
- Controller và service đều chứa một phần status validation.
- `processing_payment` được dùng khi process payment nhưng không nằm trong
  danh sách target status hợp lệ của `updateOrderStatus()`.
- `confirmPayment()` còn kiểm tra status `processing`, khác với
  `processing_payment` trong entity.
- `confirmOrder()` cập nhật trực tiếp entity, song song với generic
  `updateOrderStatus()`.
- Side effects như notification, shipper assignment và event publish đang nằm
  trong application service thay vì một transition boundary duy nhất.

## Handoff plan cho T5.1

1. Tạo `OrderStatus` contract và allowed transition table ở Ordering domain.
2. Tạo transition service/domain methods cho từng command, không để query mutate.
3. Giữ `OrderService` làm compatibility facade trong thời gian migrate caller.
4. Đưa actor/capability checks vào command boundary; không cho controller tự
   quyết định transition.
5. Thêm table-driven tests cho mọi cặp transition hợp lệ và invalid transition.

## P3.1 verdict

P3.1 handoff và characterization: **DONE**. T5.1 state-machine implementation
chưa bắt đầu trong task này.
