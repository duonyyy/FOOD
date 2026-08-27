# Phase 4 — T6.4 Payment events and Ordering handler

Date: 2026-08-28

## Implemented

- Payment success and failure are persisted with the checkout change in the same
  database transaction as an `OutboxEvent`.
- Events use stable keys scoped to the checkout and outcome:
  `Checkout:{checkoutId}:payment:succeeded|failed`.
- The payment service dispatches only after the transaction commits. A dispatch
  failure leaves the outbox row in `failed` state so the existing retry job can
  deliver it again.
- Added public `PaymentSucceeded` and `PaymentFailed` contracts. The payment
  transaction contains no notification or analytics call.
- The Ordering subscriber calls `OrderCommandService.markPaid`, not a generic
  status update. `markPaid` locks the order, transitions pending/processing
  payment to completed, and sets the paid fields atomically.
- If the order is already completed and paid, a retried event returns without a
  save or subscription publication. This makes outbox retry and duplicate event
  delivery safe.
- `OutboxEvent` is now part of the TypeORM entity registry, removing the runtime
  metadata gap for the retry worker.

## Verification

```text
npm run build                                                        PASS
npx jest src/payment/payment.idempotency.spec.ts \
  src/modules/order/order-command.service.spec.ts \
  src/modules/order/payment-succeeded-order.handler.spec.ts \
  src/common/events/outbox.service.spec.ts \
  src/infra/database/entity-registry.spec.ts --runInBand --no-cache        PASS
5 suites / 18 tests                                                   PASS
git diff --check                                                       PASS
```

The focused tests cover success/failure outbox creation, duplicate callback
handling, outbox retry, idempotent `markPaid`, and handler delegation. Provider
credentials are not present in this environment, so a real provider callback
remains a sandbox/integration check rather than a unit-test claim.
