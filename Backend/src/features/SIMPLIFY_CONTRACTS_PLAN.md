# Kế hoạch thống nhất: bỏ Ports và làm sạch boundary

> Đây là tài liệu chuẩn cho workstream refactor dependency của Foodee Backend.
> Khi tài liệu khác mâu thuẫn với file này, phải sửa tài liệu đó trước khi tiếp tục code.

## 1. Mục tiêu cuối

Foodee vẫn là modular monolith, nhưng dependency phải đơn giản và nhìn thấy được:

- Bỏ `*.port.ts`, DI `Symbol` và `useExisting` chỉ dùng để trỏ tới một service nội bộ.
- Consumer inject concrete service được export qua public API.
- Không dùng `forwardRef()` ở bất kỳ module nào.
- Không deep-import xuyên feature hoặc từ feature vào file nội bộ của infrastructure.
- Contract dữ liệu thuần dùng chung được đặt dưới `src/shared`.
- Entity, repository, service, module và runtime policy vẫn có owner rõ ràng; không đẩy vào `shared`.
- Không thay đổi REST/GraphQL contract, database schema hoặc nghiệp vụ chỉ để dọn dependency.

## 2. Quy tắc bắt buộc

### 2.1. Không còn application port một implementation

Không tạo hoặc giữ kiểu sau:

```ts
export const ORDER_READER = Symbol('ORDER_READER');
export interface OrderReaderPort { /* ... */ }

{ provide: ORDER_READER, useExisting: OrderReaderService }
```

Thay bằng concrete service:

```ts
import { OrderReaderService } from 'src/features/orders/order-reader.public-api';

constructor(private readonly orderReader: OrderReaderService) {}
```

Quy tắc này áp dụng cho Queue và Pending Assignment trong Phase 4:

- Xóa `DELIVERY_ASSIGNMENT_QUEUE_PORT` và `DeliveryAssignmentQueuePort`.
- Xóa `PENDING_ASSIGNMENT_STORE` và `PendingAssignmentStorePort`.
- Delivery inject trực tiếp `QueueService` và `RedisPendingAssignmentStore`.
- Không giữ compatibility alias sau khi mọi consumer đã chuyển.

### 2.2. Ngoại lệ không phải application port

Token dùng để inject object do thư viện bên ngoài tạo vẫn được phép, ví dụ:

- `REDIS_CLIENT`;
- BullMQ queue instance token nội bộ của QueueModule;
- MinIO/S3 client token.

Các token này phải nằm trong infrastructure và không được export như contract nghiệp vụ.
Khi có nhiều provider thật, dùng một concrete router/facade công khai. Ví dụ Payment dùng
`PaymentGatewayRouter`; interface adapter nếu còn cần chỉ là chi tiết nội bộ.

### 2.3. Không `forwardRef`

Khi có cycle:

1. Tách read service hoặc command service hẹp.
2. Export service qua `*.public-api.ts`.
3. Tạo narrow module chỉ cung cấp dependency cần thiết.
4. Dùng event/outbox nếu dependency bất đồng bộ hoặc qua transaction boundary.

Không dùng `forwardRef()` để che dependency hai chiều.

### 2.4. Không deep-import

Cross-feature chỉ được import qua:

```text
src/features/<feature>/public-api
src/features/<feature>/<use-case>.public-api
```

Cấm import `services/**`, `entities/**`, `repositories/**` hoặc module nội bộ của feature khác.
Feature chỉ dùng infrastructure qua `src/infra/<provider>/public-api`. Infrastructure tuyệt
đối không import `src/features/**`.

## 3. Chuyển contract thuần sang `src/shared`

```text
src/shared/
├── enums/
└── types/
    ├── auth/
    ├── delivery/
    ├── orders/
    └── pagination/
```

Được chuyển:

- enum/vocabulary dùng ở nhiều feature;
- POJO, union, utility type và value object không phụ thuộc framework;
- payload dữ liệu có cùng ý nghĩa ở từ hai consumer độc lập;
- request actor/context thuần sau khi xác minh field runtime.

Không được chuyển:

- TypeORM entity hoặc repository;
- NestJS service/module/controller/guard/decorator;
- DTO có validation/Swagger/GraphQL decorator;
- DI token, provider factory hoặc external client;
- runtime policy, state machine hoặc business rule;
- projection chỉ phục vụ một use case của một owner.

`shared` không được import từ `features`, `infra`, TypeORM hoặc NestJS.

## 4. Ownership không thay đổi

- Orders là nơi duy nhất quyết định trạng thái `Order`.
- Delivery sở hữu `ShippingDetail`, `ShipperProfile`, dispatch và assignment state.
- Reviews và Analytics chỉ đọc Orders qua concrete reader công khai hoặc event projection.
- Queue/cache/storage/map là technical infrastructure và không biết nghiệp vụ Delivery.
- EventBus/Outbox được giữ tại điểm cần retry, eventual consistency hoặc transaction boundary.

## 5. Lộ trình

### Giai đoạn 0 — Baseline

Lập danh sách `.port.ts`, DI Symbol, `useExisting`, provider và consumer; chạy build/unit/
integration/boundary tests trước khi sửa.

**Exit gate:** mỗi port/token có replacement và test liên quan.

### Giai đoạn 1 — Shared data contracts

Chuyển enum/type thuần dùng chung sang `src/shared` theo nhóm nhỏ; chuyển consumer bằng
`import type`; xóa type trùng và compatibility re-export khi không còn consumer.

**Exit gate:** shared boundary test pass; shared không có runtime dependency.

### Giai đoạn 2 — Concrete feature services

Export concrete reader/command service qua public API; chuyển consumer từ `@Inject(Symbol)`
sang class injection; xóa port, Symbol, binding và mock cũ trong cùng nhóm migration.

**Exit gate:** không deep-import, provider trùng hoặc compatibility alias.

### Giai đoạn 3 — Orders, Delivery, Reviews và Analytics

Giữ ownership hiện tại; synchronous interaction dùng concrete narrow service; async boundary
dùng EventBus/Outbox; narrow module chỉ export concrete service.

**Exit gate:** không có module cycle; `forwardRef` bằng 0.

### Giai đoạn 4 — Infrastructure

1. `QueueService` chỉ biết queue name, payload object và technical job options.
2. Queue registration nằm ở consumer module; Queue infra không biết `find-shipper`.
3. `RedisPendingAssignmentStore` thuộc Delivery vì dữ liệu/policy thuộc Delivery.
4. Delivery inject trực tiếp `QueueService` và `RedisPendingAssignmentStore`.
5. Cache/map/storage dùng concrete facade qua infra public API.
6. Xóa Queue/Pending port, Symbol, alias và compatibility file.

**Exit gate:** API/worker boot; retry/dead-letter/TTL/concurrency tests pass; infra không import feature.

### Giai đoạn 5 — Dọn toàn repository

Xóa port/token/alias còn lại theo owner; sửa toàn bộ deep-import; chạy full boundary tests.

**Exit gate cuối:** không `forwardRef`; không cross-feature deep-import; không application
`.port.ts`/Symbol một implementation; external token còn lại có lý do rõ ràng.

## 6. Quality gate

```text
npm run build
npm run test:unit
npm run test:integration
focused e2e tests nếu môi trường cho phép
architecture/public-api/ownership/shared-boundary tests
scoped ESLint cho file sửa
```

Static checks:

```text
rg "forwardRef\s*\(" src
rg "src/features/.+/(services|entities|repositories|modules)/" src/features
rg "src/features/" src/infra
rg "\.port" src
```

Không kết luận pass nếu chưa có output của lần chạy hiện tại.

## 7. Commit và rollback

- Mỗi owner là một commit độc lập.
- Không trộn format toàn repo, Docker, migration hoặc thay đổi API vào commit dọn port.
- Không giữ alias tạm thời qua nhiều phase; rollback bằng revert commit đúng nhóm.
- Không commit/push tự động.

