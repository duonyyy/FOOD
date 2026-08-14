# Phase 4 — P4.1 handoff and risk review

Date: 2026-08-14

## Handoff status

Phase 3 implementation is **DONE**, but its final gate is still
**CONDITIONAL**. Repository-wide lint has baseline errors, aggregate Jest did
not finish within the previous 180s/300s runs, and Docker/DB migration smoke
was not yet recorded in the Phase 3 evidence. Therefore P4.1 cannot honestly
mark the Phase 3 prerequisite as fully cleared.

## Contracts reviewed

- `src/features/orders/state-machine/order-status.ts`: valid Order transitions,
  including the separate `markPaid` path from `pending` or
  `processing_payment` to `completed`.
- `src/common/events/order-events.ts`: OrderCreated, OrderConfirmed,
  OrderCancelled and OrderPaid lifecycle event names and payload shape.
- `src/common/events/outbox.service.ts`: same-transaction enqueue and
  after-commit dispatch/retry behavior.
- `src/modules/order/order-command.service.ts`: Ordering owns status mutation
  and exposes `markPaid` as the command boundary.
- `src/modules/order/payment-succeeded-order.handler.ts`: current compatibility
  handler for `payment.succeeded`; it currently calls the legacy order facade.
- Phase 3 final report: [phase-3-final-verification](./phase-3-final-verification.md).

## Characterization verification

Command:

```text
npx jest --runInBand --no-cache --cacheDirectory=.tmp/jest \
  src/payment/payment.idempotency.spec.ts \
  src/modules/promotion/promotion-redemption.service.spec.ts \
  src/migrations/promotion-redemptions.spec.ts \
  src/modules/shipper/shipper.delivery-baseline.spec.ts \
  src/modules/shipper/shipper.authorization.spec.ts \
  src/modules/order/payment-succeeded-order.handler.spec.ts \
  src/features/orders/state-machine/order-status.spec.ts \
  src/modules/order/order-command.service.spec.ts
```

Result: **8 suites / 44 tests PASS**.

Coverage includes payment callback idempotency and amount mismatch, promotion
redemption/migration behavior, shipper assignment authorization and concurrent
winner baseline, Order status transitions, and the current payment-success
handler behavior.

## Caller map

| Area | Current entry points | Current owner/risk |
|---|---|---|
| Momo callbacks | `POST /payment/webhook`, `GET /payment/momo/result`, `POST /payment/momo/check-status` | `src/payment/payment.controller.ts` and legacy `PaymentService` |
| VNPay callbacks | `GET /payment/vnpay/result`, `GET /payment/webhook/vnpay`, `GET /payment/vnpay/status` | Controller calls gateway return/IPN mapping directly |
| Payment state | `PaymentService.handlePaymentSuccess/Failure`, `OrderService.processPayment`, `OrderCommandService.markPaid` | Multiple mutation paths still coexist |
| Assignment creation | Order confirm command and legacy Order controller status path call `addPendingAssignment` | Business assignment rule is still coupled to queue service |
| Assignment dispatch | `PendingAssignmentService` cron creates `find-shipper` jobs; `FindShipperProcessor` dispatches them | Queue boundary is not yet clean; belongs to T7.2/T7.3 |
| Shipper actions | `ShipperService.acceptAssignment`, `rejectAssignment`, `rejectOrder`, delivery transitions | Delivery ownership is still in legacy shipper module |

## Risks recorded before implementation

### Data migration risks

- Existing `Checkout` stores a payment amount and references `Order`; the order
  total can change independently. A Payments-owned transaction must snapshot
  the server-calculated amount and avoid trusting callback/client totals.
- Existing checkout rows may contain provider-specific identifiers with mixed
  formats. A new provider-reference uniqueness constraint needs a backfill and
  duplicate audit before it can be enforced.
- Payment status is currently an enum on `Checkout`, while the Phase 4 model
  needs explicit processing, succeeded, failed, canceled and refunded states.
  Migration must preserve old rows and provide a rollback path.
- There is no recorded PostgreSQL migration smoke for the Phase 3 handoff yet;
  schema changes must be tested against the actual container database before
  being treated as complete.

### Concurrency and idempotency risks

- `handlePaymentSuccess` uses a pessimistic lock in the legacy service and the
  characterization test passes, but no PostgreSQL integration test proves the
  lock/unique behavior in the real database.
- `handlePaymentFailure` has no equivalent transactional lock/idempotency path
  and still writes Order directly.
- Payment success currently has several callback paths (Momo webhook, Momo
  result, VNPay return and VNPay IPN), so the same provider event can enter more
  than one route.
- Assignment concurrency is covered by a unit baseline only; the required
  PostgreSQL accept/reassign test remains a T7.4 task.
- `payment.succeeded` currently reaches a compatibility handler that calls the
  legacy Order facade and requests status `pending`; this must be reconciled
  with the Phase 3 `markPaid` contract in T6.4.

### Boundary and security risks

- `src/payment/payment.service.ts` directly injects Order, OrderDetail, Food,
  User and Promotion repositories. It also updates Order and Food after
  payment. This is explicitly a T6.5 blocker, not a new Payments contract.
- Payment gateway interfaces and webhook handling still use broad `any`
  payloads; provider signature, reference, amount and currency validation must
  be centralized in T6.2/T6.3.
- Payment details are stored as JSON and gateway metadata is passed through
  legacy paths. Provider secrets, tokens, card data and raw callback payloads
  must never be serialized or logged.

## Verdict

P4.1 handoff/risk review: **DONE WITH CONDITIONAL PREREQUISITE**.

The evidence and caller/risk map are ready. T6.1 may now proceed only with the
above constraints visible; it should not silently assume that Phase 3's global
quality/runtime gate is fully closed.
