# Phase 4 — T6.5 Payment cross-feature cleanup

Date: 2026-08-28

## Result

- Payment persistence is limited to `Checkout` and its own provider metadata.
- Payment does not import or inject Ordering, Catalog, Promotions, Identity or
  Restaurant repositories/services.
- Payment does not update Order status, Food sales or Promotion usage directly.
- Payment publishes provider-neutral payment events through the shared outbox;
  Ordering owns the `markPaid` command and its idempotency.
- Added an architecture test that scans all non-test TypeScript sources under
  `src/payment`, checks forbidden cross-feature imports/mutation names, and
  verifies the module persistence boundary.

## Verification

```text
npm run build                                      PASS
npx jest src/payment/payment.ownership.spec.ts \
  src/payment/payment.cross-feature-boundary.spec.ts \
  src/payment/payment.idempotency.spec.ts --runInBand --no-cache          PASS
3 suites / 12 tests                               PASS
git diff --check                                  PASS
```

The demo payment controller still owns an in-memory demo order map for its
explicit demo-only endpoints; it does not touch the real Order/Food/Promotion
persistence boundary.
