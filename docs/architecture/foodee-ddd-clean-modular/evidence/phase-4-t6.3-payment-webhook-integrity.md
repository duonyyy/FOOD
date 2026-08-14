# Phase 4 — T6.3 Payment webhook integrity and idempotency

Date: 2026-08-14

## Callback contract

- MoMo verifies `x-payment-signature` before any gateway or persistence side
  effect. It requires provider reference, provider transaction id and amount.
- VNPay verifies `vnp_SecureHash` before dispatching the callback. Its amount is
  normalized from the provider's minor unit (`vnp_Amount / 100`).
- A provider callback is checked against the persisted Checkout snapshot:
  payment method, provider reference, signed order reference equality, amount
  and currency. Provider reference is the distinct Checkout id, while the
  callback `orderInfo` must equal the internal `Checkout.orderId`. The browser MoMo redirect is non-authoritative and cannot
  mutate payment state.
- A successful/failing verified callback returns the stable acknowledgement
  `{ acknowledged: true, duplicate, outcome }`. A replay returns `duplicate:
  true` and does not publish another success event.

## Database guarantee

Migration `1761000000001-AddPaymentWebhookIdempotency` adds the internal
`providerTransactionId` and `webhookIdempotencyKey` fields plus partial unique
indexes for:

- `paymentIntentId` (provider reference)
- `providerTransactionId`
- `webhookIdempotencyKey`

The payment callback locks the Checkout row (`pessimistic_write`) before the
state transition, so concurrent replays result in exactly one persisted change
and one published success event.

## Verification

```text
npm run build                                      PASS
npx jest --runInBand --no-cache --cacheDirectory=.tmp/jest \
  src/payment/payment.idempotency.spec.ts \
  src/common/validation/strict-validation.compatibility.spec.ts \
  src/infra/payment-gateways/payment-gateway.contract.spec.ts
                                                    PASS: 3 suites / 16 tests

docker --context desktop-linux compose build api migrate   PASS
docker --context desktop-linux compose up -d migrate api   PASS
GET http://localhost:3000/health                           200
POST /payment/webhook without signature                    400
```

The PostgreSQL container confirms all three unique indexes and both new
idempotency columns. A real signed callback still needs provider sandbox
credentials; credentials are intentionally absent in this local environment.

Known unrelated runtime risk: the existing OutboxEvent registry warning remains
and must be resolved before the outbox event task (T6.4).
