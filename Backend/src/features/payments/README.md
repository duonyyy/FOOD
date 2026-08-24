# payments

Owner đích: Checkout, gateway transaction, webhook validation, reconciliation và refund state. Compatibility implementation: `src/payment`.

T6.1 owns Checkout and T6.2 consumes provider-neutral gateway ports. T6.3–T6.6
will finish webhook integrity, outbox events, cross-feature cleanup and
reconciliation without direct writes to Orders/Menu/Identity/Promotions.
