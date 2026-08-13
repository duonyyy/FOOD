# Phase 3 — T5.3 Pure pricing

Date: 2026-08-13

## Scope completed

- Tạo `OrderPricingService` thuần, không inject repository, database,
  promotion provider, Mapbox hoặc request object.
- Input chỉ gồm server-side item snapshots: unit price, discount, quantity,
  topping unit prices; cộng shipping fee và promotion discount đã được
  application layer validate.
- Client-provided `total` không nằm trong contract và không được dùng để tính.
- Tính tập trung line total, food subtotal, shipping, promotion discount và
  final total.
- Áp dụng currency rule hiện tại: tiền VND là số nguyên, round line/fee/
  discount về integer và total không âm; discount phần trăm được giới hạn
  trong `0..100`.
- Nối pure service vào preview pricing, custom-address pricing và
  `OrderCreateService`; việc đọc Food/Topping và validate promotion vẫn nằm ở
  application layer để tạo snapshot trước khi gọi pure calculator.

## Boundary

```text
Food/Topping repositories + promotion validation
                    |
                    v
       server-side pricing snapshots
                    |
                    v
           OrderPricingService.calculate()
                    |
                    v
       subtotal / discount / shipping / total
```

Pure service không biết `Order`, TypeORM, `PromotionService`, request DTO hay
client total. Vì vậy có thể test deterministic và tái sử dụng cho preview/
create mà không gọi external dependency.

## Verification

```text
npm run build
npx jest --runInBand --no-cache --cacheDirectory=.tmp/jest \
  src/features/orders/pricing/order-pricing.service.spec.ts \
  src/modules/order/order.pricing-state.spec.ts
```

Result: **2 suites / 13 tests PASS**; build PASS.

Test cases gồm discount + toppings, nhiều line, promotion/shipping, giá trị
âm/ngoài range và xác nhận snapshot không bị mutate/không đọc trusted total.

## Verdict

T5.3: **DONE**. Pricing đã có một pure source of truth và các flow chính đã
delegate sang calculator này.
