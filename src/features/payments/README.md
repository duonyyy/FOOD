# payments

Owner đích: Checkout, gateway transaction, webhook validation, reconciliation và refund state. Compatibility implementation: `src/payment`.

T6.1–T6.6 removes direct writes to Orders/Menu/Identity/Promotions after gateway webhook and idempotency contracts are tested.
