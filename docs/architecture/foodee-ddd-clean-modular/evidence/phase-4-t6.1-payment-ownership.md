# Phase 4 — T6.1 Payment ownership

Date: 2026-08-14

## Result

`Payments` now owns the `Checkout` payment record. The record is an independent
payment aggregate: it references Ordering only through `orderId` and stores the
server-authoritative amount/currency snapshot captured when Ordering creates it.

## Boundary changes

- `Checkout` no longer has `User` or `Order` TypeORM relations; `Order` and
  `User` no longer expose checkout collections.
- `PaymentService` only injects `Repository<Checkout>`, payment gateways,
  configuration and the event bus. It no longer injects Order, OrderDetail,
  Food, User or Promotion repositories.
- `OrderController` passes `{ orderId, amount, currency }` into Payments after
  Ordering has priced and persisted the order. The client total is not used by
  Payments.
- `PaymentModule` registers only `Checkout`; duplicate and cross-feature
  persistence providers were removed.

## Lifecycle and sensitive data

The explicit payment state machine permits only:

```text
PENDING -> COMPLETED | FAILED | CANCELLED
```

Terminal states cannot transition again. Signed provider redirect URLs are
transient and are not database columns. Payment request fields such as card
number, CVV, token, secret, signature and authorization are excluded from
persisted provider metadata.

## Migration

`1761000000000-RefactorCheckoutPaymentOwnership` removes legacy `userId` and
`paymentUrl` columns, converts `paymentIntentId` to text (provider references
are not necessarily UUIDs), and adds the non-null `currency` snapshot.

Rollback intentionally converts only UUID-shaped provider references back to a
UUID; non-UUID references become `NULL` rather than making the rollback fail.

## Verification

```text
npm run build                                      PASS
npx jest --runInBand --no-cache --cacheDirectory=.tmp/jest \
  src/payment/payment.idempotency.spec.ts \
  src/payment/payment.ownership.spec.ts \
  src/features/payments/domain/payment-status-machine.spec.ts
                                                    PASS: 3 suites / 11 tests
```

Docker verification:

```text
docker --context desktop-linux compose build api migrate     PASS
docker --context desktop-linux compose up -d migrate api     PASS
GET http://localhost:3000/health                             200
```

The migration executed successfully against the active PostgreSQL container.
`checkouts` now has `orderId`, `amount`, `currency`, `paymentMethod`, text
`paymentIntentId`, state and safe provider metadata; it no longer has `userId`
or persisted `paymentUrl`.

Known environment warnings outside T6.1 remain: VNPay credentials are absent
and the pre-existing OutboxEvent registry warning still needs resolution before
the outbox-based payment-event task (T6.4).
