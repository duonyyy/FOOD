# Phase 4 — T6.2 Gateway ports and adapters

Date: 2026-08-14

## Result

Payments now consumes `PaymentGatewayPort`, not concrete MoMo/VNPay classes.
`PaymentGatewayRouter` is the only infrastructure resolver; it selects an
adapter for `momo` or `vnpay` and lets `PaymentService` remain provider-neutral.

## Contract and error behavior

- `PaymentGatewayPort` standardizes create, confirm, cancel, refund, query and
  webhook-signature operations.
- `PaymentGatewayError` explicitly records provider, operation, error code and
  whether retry is safe.
- MoMo HTTP requests use `PAYMENT_GATEWAY_TIMEOUT_MS` (default 10 seconds).
  Timeout/network/5xx/429 errors are retryable; invalid configuration and
  provider 4xx rejections are not.
- MoMo and VNPay require provider-specific credentials at payment/signature
  execution. Development startup may warn so non-payment APIs stay available,
  but a payment attempt fails closed with `CONFIGURATION_MISSING`.
- No sample credential or signed payment URL is used as a fallback. Redirect
  URLs remain transient `clientSecret` data, not provider metadata.

## Contract verification

```text
npm run build                                      PASS

npx jest --runInBand --no-cache --cacheDirectory=.tmp/jest \
  src/infra/payment-gateways/payment-gateway.contract.spec.ts
                                                    PASS: 1 suite / 4 tests

npx jest --runInBand --no-cache --cacheDirectory=.tmp/jest \
  src/payment/payment.idempotency.spec.ts \
  src/payment/payment.ownership.spec.ts \
  src/provider-ownership.spec.ts \
  src/config/production-config.guard.spec.ts
                                                    PASS: 4 suites / 15 tests
```

The contract tests verify MoMo request/signature mapping, MoMo timeout
classification, VNPay URL/signature mapping, and fail-fast missing credentials.

## Docker verification

```text
docker --context desktop-linux compose build api   PASS
docker --context desktop-linux compose up -d api   PASS
GET http://localhost:3000/health                   200
```

Both adapters initialized in sandbox mode. Provider credential warnings are
expected for this environment; no real provider transaction was sent. The
pre-existing `OutboxEvent` registry warning remains outside T6.2 scope and
must be resolved before T6.4.
