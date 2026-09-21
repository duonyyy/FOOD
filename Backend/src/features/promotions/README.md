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
├── contracts/          # Policy nội bộ của Promotion
│   └── promotion-cache.policy.ts
├── dto/                # Request DTOs
│   ├── create-promotion.dto.ts
│   ├── update-promotion.dto.ts
│   └── index.ts
├── promotions.module.ts
├── public-api.ts       # Re-export cho feature khác dùng
└── README.md
```

Promotion exports concrete promotion services through its public API. Orders and Payments must not write Promotion repositories directly.
