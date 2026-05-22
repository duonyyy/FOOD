# Services

Thu muc `src/services` chua cac service dung chung cho nhieu module. Day khong phai la domain rieng nhu `order`, `food`, `restaurant`, ma la lop ho tro nghiep vu va tich hop ben ngoai.

## Doc nhanh

- [Tong quan nghiep vu](./docs/00-overview.md)
- [GeocodingService - dia chi sang toa do](./docs/01-geocoding-service.md)
- [MapboxService - tinh quang duong va thoi gian giao hang](./docs/02-mapbox-service.md)
- [SystemConstraintsService - cau hinh va rule giao hang](./docs/03-system-constraints-service.md)
- [Cac flow nghiep vu lien quan](./docs/04-business-flows.md)
- [Ghi chu bao tri va refactor](./docs/05-maintenance-notes.md)

## File code hien tai

```text
src/services/
├── geocoding.service.ts
├── mapbox.service.ts
├── system-constraints.service.ts
└── docs/
```

## Tom tat 1 dong

- `GeocodingService`: chuyen dia chi text thanh `latitude/longitude`.
- `MapboxService`: tinh quang duong va thoi gian di chuyen giua 2 toa do.
- `SystemConstraintsService`: quan ly nguong nghiep vu giao hang, eligibility shipper, phi ship.

## Bien moi truong quan trong

```env
MAPBOX_ACCESS_TOKEN=your_mapbox_token
```

Neu thieu token nay:

- `GeocodingService` chi log warning va tra `null`.
- `MapboxService` se throw loi ngay trong constructor.

