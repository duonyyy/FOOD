# Phase 3 — T5.2 Order command/query split

Date: 2026-08-13

## Scope completed

- Tạo `OrderCreateService` cho CreateOrder và giữ public facade tương thích ở
  `OrderService`.
- Tạo `OrderQueryService` cho các read use case:
  `getAllOrders`, `getOrderById`, `getOrdersByUser`, `getOrdersByRestaurant`,
  `getOrderDetails`, order history và quick-reorder history.
- Tạo `OrderCommandService` cho các mutation chính:
  status transition, confirm, reject, cancel, complete và mark paid.
- Giữ `OrderService` làm compatibility facade để controller, chat flow và
  payment handler hiện tại chưa phải đổi API trong cùng task.
- Chuyển logic làm sạch dữ liệu nhạy cảm sang query boundary; command không
  chứa query projection/history logic.
- Giữ state machine ở Ordering domain làm luật chung cho command service.
- Payment gateway, delivery queue và actor policy chưa bị kéo vào command
  service; các boundary đó thuộc T5.5–T5.7/T6/T7.

## Wiring

`OrderModule` đăng ký `OrderQueryService` và `OrderCommandService`. Các caller
cũ vẫn gọi `OrderService`, nhưng facade chỉ delegate các method read/command đã
tách. Vì vậy đây là migration không breaking, có thể tiếp tục chuyển caller
từng nhóm ở các task sau.

## Verification

```text
npm run build

npx jest --runInBand --no-cache --cacheDirectory=.tmp/jest \
  src/modules/order/order-command.service.spec.ts \
  src/modules/order/order.pricing-state.spec.ts \
  src/features/orders/state-machine/order-status.spec.ts \
  src/modules/order/payment-succeeded-order.handler.spec.ts
```

Result: **4 suites / 34 tests PASS**; build PASS.

Command service tests cover valid transition, invalid transition không save,
confirm tạo pending assignment và mark paid. State-machine tests tiếp tục
đảm bảo command không bypass transition table.

## Known follow-up

- `processPayment()` vẫn nằm trong compatibility facade vì còn gắn payment
  transaction compatibility logic; sẽ tách ở T5.5.
- Một số caller legacy vẫn gọi facade trực tiếp; chưa xóa `OrderService`.
- Repository-wide lint vẫn có legacy format/`any` baseline ngoài scope.

## Verdict

T5.2: **DONE** cho command/query boundary đầu tiên và migration an toàn. Các
task tiếp theo có thể tiếp tục tách pricing, transaction và controller mà không
phải gom thêm read logic vào `OrderService`.
