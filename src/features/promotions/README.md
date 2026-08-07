# promotions

Owner đích: Promotion, eligibility, reservation và redemption. Compatibility implementation: `src/modules/promotion`.

T2.3 exports `PromotionRedemptionPort`; T5.5 binds its transaction/idempotency implementation. Orders and Payments must not write Promotion repositories directly.
