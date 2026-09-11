# promotions

Owner: Promotion, eligibility, reservation và redemption.

## Cấu trúc

```text
promotions/
├── controllers/        # HTTP endpoints
│   ├── promotion.controller.ts   # Admin CRUD + public query
│   └── index.ts
├── services/           # Business logic
│   ├── promotion.service.ts             # CRUD, validation, discount calc, caching
│   ├── promotion-redemption.service.ts  # Redemption trong transaction
│   └── index.ts
├── contracts/          # Port/interface cho bounded context khác
│   ├── promotion-redemption.port.ts
│   └── index.ts
├── dto/                # Request DTOs
│   ├── create-promotion.dto.ts
│   ├── update-promotion.dto.ts
│   └── index.ts
├── promotions.module.ts
├── public-api.ts       # Re-export cho feature khác dùng
└── README.md
```

T2.3 exports `PromotionRedemptionPort`; T5.5 binds its transaction/idempotency implementation. Orders and Payments must not write Promotion repositories directly.
