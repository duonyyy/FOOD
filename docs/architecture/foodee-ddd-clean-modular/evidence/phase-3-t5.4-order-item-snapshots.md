# Phase 3 — T5.4 OrderItem immutable snapshots

Date: 2026-08-13

## Scope completed

- Bổ sung `food_name_snapshot` và `unit_price_snapshot` cho `orderDetails`.
- Khi tạo order, lưu food name, charged unit price, quantity và topping
  snapshots ngay tại thời điểm command chạy.
- `selected_toppings` tiếp tục lưu id/name/price snapshot; không dùng giá
  topping từ request làm nguồn sự thật.
- Order history và quick reorder ưu tiên snapshot, chỉ fallback sang live Food
  cho dữ liệu cũ chưa được backfill.
- Thêm migration `1760000000003-AddOrderItemSnapshots` để add column, backfill
  từ Food/giá cũ và rollback được cả hai column.
- Snapshot helper deep-copies/freeze các giá trị để Catalog thay đổi sau đó
  không làm thay đổi dữ liệu đã chụp.

## Compatibility/data plan

- Column mới nullable để deploy không phá record cũ.
- Migration backfill `food_name_snapshot` từ `foods.name` và
  `unit_price_snapshot` từ giá OrderDetail hiện có.
- Query fallback vẫn hỗ trợ record cũ nếu migration chưa chạy hoặc snapshot
  null.
- Down migration drop hai column; dữ liệu snapshot khi rollback sẽ mất, còn
  relation Food/price cũ vẫn giữ nguyên.

## Verification

```text
npm run build
npx jest --runInBand --no-cache --cacheDirectory=.tmp/jest \
  src/features/orders/snapshots/order-item-snapshot.spec.ts \
  src/migrations/order-item-snapshots.spec.ts \
  src/modules/order/order.pricing-state.spec.ts
```

Result: **3 suites / 12 tests PASS**; build PASS.

Test chứng minh Catalog đổi tên/giá/topping sau khi tạo snapshot không làm đổi
snapshot cũ; migration test kiểm tra up/backfill và down.

## Verdict

T5.4: **DONE**. OrderItem đã có snapshot fields và history không còn bắt buộc
phụ thuộc live Food để hiển thị tên/giá của order cũ.
