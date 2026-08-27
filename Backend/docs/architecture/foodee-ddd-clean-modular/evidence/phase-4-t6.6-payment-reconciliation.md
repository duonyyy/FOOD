# Phase 4 — T6.6 Payment reconciliation

Date: 2026-08-28

## Result

- Added a scheduled reconciliation job in `src/payment/payment-reconciliation.service.ts`.
- The job only selects stale `PENDING` checkouts with a provider payment intent,
  claims each row with a pessimistic lock, and stores durable attempt state.
- Retry count, stale window and batch size are configurable through
  `PAYMENT_RECONCILIATION_MAX_ATTEMPTS`,
  `PAYMENT_RECONCILIATION_STALE_AFTER_MINUTES` and
  `PAYMENT_RECONCILIATION_BATCH_SIZE`.
- Provider success is reconciled through the existing payment transaction/outbox
  path only when provider reference, order reference, amount, currency and
  provider transaction id all match the Checkout snapshot.
- Missing or mismatched evidence leaves the checkout `PENDING`; the job never
  changes amount, order reference or provider reference. Exhausted rows are
  skipped and logged.
- Added Checkout reconciliation columns and migration
  `1761000000002-AddPaymentReconciliationState`.
- Fixed both TypeORM migration globs to exclude Jest `*.spec.ts` files; the
  migration CLI now discovers only timestamp-prefixed migration sources.

## Verification

```text
npm run build                                                    PASS
npx jest --runInBand src/infra/payment-gateways/payment-gateway.contract.spec.ts \
  src/payment/payment-reconciliation.service.spec.ts \
  src/payment/payment.idempotency.spec.ts \
  src/migrations/payment-reconciliation-state.spec.ts            PASS
4 suites / 19 tests                                               PASS
git diff --check                                                 PASS
```

Runtime verification:

```text
PostgreSQL migration AddPaymentReconciliationState1761000000002  PASS
checkouts reconciliation columns (3)                             PASS
Docker Compose api/db/redis/minio/ai-server                      HEALTHY/RUNNING
GET http://localhost:3000/health                                  200 {"status":"ok","service":"foodee-api"}
```

The provider adapters are intentionally conservative. MoMo now maps query
amount/reference/orderInfo/transaction id when supplied by the provider. VNPay
continues to report `PENDING` because this adapter has no implemented merchant
transaction-query API; it therefore cannot be auto-reconciled without stronger
provider evidence.
