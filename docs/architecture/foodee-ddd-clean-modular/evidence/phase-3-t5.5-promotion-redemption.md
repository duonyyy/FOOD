# Phase 3 — T5.5 Promotion redemption transaction/idempotency

Date: 2026-08-13

## Scope completed

- Tạo `promotion_redemptions` với status `reserved`, `committed`, `released`.
- Unique constraint theo `order_id`, foreign key tới Order/Customer/Promotion
  và index cho promotion/customer query.
- `PromotionRedemptionService.redeemInTransaction()` nhận `EntityManager` của
  outer Order transaction; không tự mở transaction phụ.
- Retry cùng `orderId` + promotion code trả redemption cũ, không gọi tăng
  `numberOfUsed` lần hai.
- Nếu cùng order dùng code khác, command bị từ chối.
- Promotion increment và redemption insert dùng cùng manager; order rollback
  sẽ rollback cả hai.
- Ordering không còn gọi `PromotionService.usePromotion()` ở public
  `OrderCreateService`; việc increment/redemption thuộc Promotions service.
- Cache invalidation vẫn chạy sau commit thành công, không chạy trong outer
  transaction.

## Transaction flow

```text
OrderCreateService transaction
  -> save Order
  -> save OrderItems
  -> PromotionRedemptionService.redeemInTransaction(manager)
       -> lock/find promotion
       -> PromotionService.usePromotion(..., manager)
       -> insert unique promotion_redemptions(order_id)
  -> commit
  -> clear promotion cache
```

Concurrent retry được bảo vệ bởi pessimistic lock, unique `order_id` và
idempotent existing-redemption check. A failed outer transaction rolls back
the usage increment and redemption record together.

## Verification

```text
npm run build
npx jest --runInBand --no-cache --cacheDirectory=.tmp/jest \
  src/modules/promotion/promotion-redemption.service.spec.ts \
  src/migrations/promotion-redemptions.spec.ts \
  src/modules/order/order.pricing-state.spec.ts
```

Result: **3 suites / 14 tests PASS**; build PASS.

Tests cover same-manager increment/insert, retry idempotency, different-code
rejection, migration unique/status constraints and order flow integration.

## Remaining follow-up

The older private legacy implementation retained inside `OrderService` is no
longer the public create path and should be removed in cleanup. The active
`OrderCreateService` path is the one covered by this task.

## Verdict

T5.5: **DONE** for the active order creation flow. Redemption ownership,
transaction boundary and idempotency are now explicit.
