# Phase 3 — T5.6 Outbox/after-commit events

Date: 2026-08-13

## Scope completed

- Tạo `outbox_events` với event type, aggregate, JSON payload, idempotency key,
  status, attempts, retry time và last error.
- Unique idempotency key chống ghi trùng cùng lifecycle event.
- `OrderCreateService` ghi `OrderCreated` vào outbox bằng cùng `EntityManager`
  trước khi commit; event không được coi là dispatched nếu transaction rollback.
- Sau commit, service thử dispatch event; nếu bus lỗi thì ghi `failed`, tăng
  attempts, lưu lỗi và đặt exponential backoff.
- Cron retry mỗi 10 giây gọi `dispatchPending()`, xử lý cả pending/failed đến
  hạn.
- Event đã `published` là idempotent: retry không publish lại.
- Có contract cho `OrderCreated`, `OrderConfirmed`, `OrderCancelled`,
  `OrderPaid`; các event status được định nghĩa rõ.

## Lifecycle

```text
same transaction: Order + OrderItems + PromotionRedemption + OutboxEvent
                         |
                       COMMIT
                         v
                  dispatch event
                    /       \
                 success     failure
                   |            |
               published   failed + backoff
                                |
                         retry cron -> publish
```

## Verification

```text
npm run build
npx jest --runInBand --no-cache --cacheDirectory=.tmp/jest \
  src/common/events/outbox.service.spec.ts \
  src/migrations/outbox-events.spec.ts \
  src/modules/order/order.pricing-state.spec.ts
```

Result: **3 suites / 12 tests PASS**; build PASS.

Tests cover publish-once/idempotency, failure persistence with retry metadata,
migration constraints and OrderCreate wiring.

## Remaining follow-up

Existing legacy `pubSub` publications in older controller/payment paths are
kept for compatibility. New OrderCreate event path is outbox-backed; later
controller/payment migration can remove duplicate legacy publications.

## Verdict

T5.6: **DONE** for the active OrderCreate lifecycle. Outbox persistence,
after-commit dispatch and retry behavior are implemented.
