# Kế hoạch chuyển contract dữ liệu sang `src/shared`

> File này chỉ nói về type/enum/value object thuần. Quy tắc bỏ port và dependency nằm tại
> `SIMPLIFY_CONTRACTS_PLAN.md`.

## 1. Mục tiêu

- Có một nơi chuẩn cho contract dữ liệu thật sự dùng chung.
- Loại bỏ type trùng và deep-import chỉ để lấy interface/type.
- Không biến `src/shared` thành feature ẩn hoặc nơi gom file khó phân loại.
- Không chuyển runtime dependency sang shared.

## 2. Cấu trúc đích

```text
src/shared/
├── enums/
│   ├── auth-provider.enum.ts
│   ├── order-status.enum.ts
│   └── permission.enum.ts
└── types/
    ├── auth/
    ├── delivery/
    ├── orders/
    └── pagination/
```

Import trực tiếp file cụ thể; không tạo barrel tổng cho toàn bộ `src/shared`.

## 3. Điều kiện để chuyển

Một contract chỉ được chuyển khi đồng thời:

1. Có cùng ý nghĩa, không chỉ tình cờ giống field.
2. Có ít nhất hai feature độc lập sử dụng hoặc là vocabulary cấp ứng dụng.
3. Là TypeScript thuần, không decorator và không runtime provider.
4. Không chứa business rule/state transition của một owner.
5. Có test boundary và danh sách consumer rõ ràng.

Nếu thiếu một điều kiện, type ở lại feature owner và được export qua public API hẹp.

## 4. Được phép và bị cấm

### Được phép

- enum trạng thái/vocabulary dùng xuyên feature;
- authenticated actor/request shape đã xác minh;
- pagination primitive;
- coordinate/money/value object có một nghĩa thống nhất;
- technical options thuần không gắn với business payload.

### Bị cấm

- entity, repository, service, module, controller, guard;
- DI token hoặc provider factory;
- DTO có `class-validator`, Swagger hoặc GraphQL decorator;
- event handler, queue processor, policy hoặc state machine;
- universal `Order`, `User` hoặc `Restaurant` model;
- port/interface chỉ tồn tại để phục vụ dependency injection.

## 5. Danh sách triển khai

### Nhóm A — Đã có

- `OrderStatus`;
- `AuthProvider`;
- `Permission`, `PermissionType`.

Giữ test cấm các file này import NestJS, TypeORM, feature hoặc infra.

### Nhóm B — Ưu tiên tiếp theo

1. Audit `AuthenticatedRequest`, `AuthenticatedUser`, `GraphqlAuthContext`.
2. Xác minh field từ guard/strategy: `id`, `uid`, `sub`, `userId`, `role`.
3. Tạo contract tối thiểu dưới `src/shared/types/auth/`.
4. Chuyển Auth, Locations, Delivery, Menu và Communications theo từng nhóm.
5. Xóa interface trùng; không dùng cast rộng để ép tương thích.

### Nhóm C — Xét từng trường hợp

- Pagination primitives.
- Coordinates nếu các consumer dùng cùng đơn vị/quy ước.
- Money/currency nếu đã có một contract thống nhất.
- Queue technical options nếu không chứa tên job hoặc payload nghiệp vụ.

Không tự động chuyển projection Orders/Delivery/Menu chỉ vì có nhiều consumer.

## 6. Quan hệ với public API

- Type shared: import từ `src/shared/...`.
- Concrete feature service: import từ `src/features/<owner>/*.public-api`.
- Concrete infrastructure facade: import từ `src/infra/<provider>/public-api`.
- Không re-export type shared qua nhiều feature public API lâu dài.
- Không deep-import vào thư mục `types/` của feature khác.

## 7. Các bước cho mỗi nhóm

1. Lập bảng source type, consumer, field sử dụng và owner nghiệp vụ.
2. Chạy baseline tests.
3. Tạo file shared thuần.
4. Chuyển import bằng `import type` khi phù hợp.
5. Xóa type cũ và alias sau khi `rg` không còn consumer.
6. Cập nhật `shared-types-boundaries.spec.ts` bằng allowlist cụ thể.

## 8. Exit gate

- Shared không import feature/infra/framework.
- Không còn duplicate type của nhóm vừa chuyển.
- Không deep-import xuyên feature.
- Không thêm `forwardRef`.
- API và authorization behavior không đổi.
- Build, unit, integration, shared-boundary và scoped ESLint pass.

