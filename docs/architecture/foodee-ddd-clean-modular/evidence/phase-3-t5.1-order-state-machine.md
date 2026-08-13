# Phase 3 — T5.1 Order state machine

Date: 2026-08-13

## Scope completed

- Tạo `OrderStatus` contract cho toàn bộ status đang lưu trong `orders`:
  `pending`, `confirmed`, `delivering`, `shipper_received`, `completed`,
  `canceled`, `processing_payment`.
- Tập trung allowed transition table trong
  `src/features/orders/state-machine/order-status.ts`.
- Thêm domain methods cho `confirm`, `reject`, `cancel`, nhận đơn bởi shipper,
  bắt đầu giao, hoàn tất, bắt đầu thanh toán và mark paid.
- `OrderService.updateOrderStatus()`, `confirmOrder()`, `processPayment()` và
  `confirmPayment()` dùng state machine thay vì tự định nghĩa luật cục bộ.
- Query của state machine chỉ đọc bảng transition; bảng được freeze để tránh
  bị thay đổi trong runtime.
- Invalid status và invalid transition có error type/message ổn định, sau đó
  được map thành `BadRequestException` ở application service.
- Sửa mismatch `processing`/`processing_payment` trong `confirmPayment()`.

## Transition table

| Current status | Allowed next status | Actor/caller hiện tại |
|---|---|---|
| `pending` | `confirmed`, `canceled` | merchant confirm; customer/system cancel |
| `confirmed` | `shipper_received`, `delivering`, `canceled` | delivery workflow; merchant/system cancel |
| `shipper_received` | `delivering`, `canceled` | delivery workflow |
| `delivering` | `completed`, `canceled` | delivery workflow/system |
| `processing_payment` | `pending`, `canceled` | payment success recovery; timeout job |
| `completed` | none | terminal |
| `canceled` | none | terminal |

`markPaid()` là command-specific transition cho `pending` hoặc
`processing_payment` sang `completed`; transition generic không mở
`pending -> completed` cho endpoint status chung.

Actor/capability enforcement vẫn nằm ở caller hiện tại và sẽ được gom vào
T5.7 controllers/policies. T5.1 chỉ chịu trách nhiệm đảm bảo mọi caller không
thể bypass luật trạng thái.

## Verification

Command:

```text
npx jest --runInBand --no-cache --cacheDirectory=.tmp/jest \
  src/features/orders/state-machine/order-status.spec.ts \
  src/modules/order/order.pricing-state.spec.ts \
  src/modules/order/payment-succeeded-order.handler.spec.ts
```

Result: **3 suites / 30 tests PASS**.

Additional checks:

- `npm run build`: PASS.
- ESLint riêng cho hai file state machine: PASS.
- `git diff --check`: PASS.
- Repository-wide lint chưa được dùng làm gate của task này vì
  `src/modules/order/order.service.ts` đã có legacy CRLF/prettier và `any`
  baseline ngoài phạm vi T5.1; cần xử lý riêng trong cleanup/quality gate.

## Remaining scope

T5.1 chưa tách `OrderService` thành command/query services, chưa di chuyển
side effects sang outbox và chưa thay các direct status writes trong Payment
hoặc Delivery. Các việc đó thuộc T5.2, T5.5–T5.7 và không được giả định là đã
hoàn thành từ state machine này.

## Verdict

T5.1: **DONE**. State transition rule đã có một nguồn sự thật, được gọi từ
compatibility facade hiện tại và có test cho toàn bộ bảng transition cùng các
command-specific paths.
