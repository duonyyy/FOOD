# promotions

Owner: Promotion, eligibility, reservation và redemption.

## Cấu trúc

```text
promotions/
├── controllers/
│   ├── public-promotions.controller.ts  # Public active-promotion query
│   └── admin-promotions.controller.ts   # Admin CRUD
├── services/
│   ├── public-promotions.service.ts     # Public query, eligibility và discount
│   ├── admin-promotions.service.ts      # Admin CRUD và cache invalidation
│   └── promotion-redemption.service.ts  # Redemption idempotent trong transaction
├── contracts/
│   ├── promotion-cache.policy.ts
│   └── promotion-eligibility.policy.ts
├── dto/
│   ├── create-promotion.dto.ts
│   └── update-promotion.dto.ts
├── promotions.module.ts
├── public-api.ts
└── README.md
```

## Public API

- `PromotionsModule`: module chính duy nhất.
- `PublicPromotionsService`: Orders dùng để kiểm tra eligibility và tính discount.
- `PromotionRedemptionService`: Orders ghi redemption trong transaction và xóa cache sau commit.

`AdminPromotionsService`, controller, entity, repository và policy không được export. Orders và
Payments không được ghi trực tiếp Promotion repository.

Promotions không nhận business event ở thời điểm hiện tại. Feature dùng cache và storage thông qua
public API của `src/infra`.
