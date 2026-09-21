# promotions

Owner: Promotion, quy tắc áp dụng và việc sử dụng mã khuyến mãi.

## Cấu trúc

```text
promotions/
├── controllers/
│   ├── public-promotions.controller.ts  # Public active-promotion query
│   └── admin-promotions.controller.ts   # Admin CRUD
├── services/
│   ├── public-promotions.service.ts     # Public query, rules và discount
│   ├── admin-promotions.service.ts      # Admin CRUD và cache invalidation
│   └── promotion-usage.service.ts       # Ghi nhận lượt dùng idempotent trong transaction
├── contracts/
│   ├── promotion-cache.policy.ts
│   └── promotion-rules.policy.ts
├── dto/
│   ├── create-promotion.dto.ts
│   └── update-promotion.dto.ts
├── promotions.module.ts
├── public-api.ts
└── README.md
```

## Public API

- `PromotionsModule`: module chính duy nhất.
- `PublicPromotionsService`: Orders dùng để kiểm tra quy tắc áp dụng và tính discount.
- `PromotionUsageService`: Orders ghi nhận lượt dùng trong transaction và xóa cache sau commit.

`AdminPromotionsService`, controller, entity, repository và policy không được export. Orders và
Payments không được ghi trực tiếp Promotion repository.

Entity và bảng `PromotionRedemption`/`promotion_redemptions` tạm giữ tên cũ để tương thích schema đã
triển khai. Tên ở lớp ứng dụng dùng `usage` để dễ hiểu; việc đổi schema phải có migration riêng.

Promotions không nhận business event ở thời điểm hiện tại. Feature dùng cache và storage thông qua
public API của `src/infra`.
