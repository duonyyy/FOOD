# BÁO CÁO KIỂM TRA CODEBASE FOODEE BACKEND

> Repository kiểm tra: `foodee-be/Backend`
>
> Ngày cập nhật: 2026-09-24
>
> Loại kiểm tra: đọc code, kiểm tra Git, chạy build/full unit/full integration/full E2E/lint
>
> Chuẩn cấu trúc hiện hành: `src/features/README.md`

## 1. Kết luận ngắn

Foodee Backend build được; full unit, integration có skip, E2E và boundary test đều qua trong lần chạy 2026-09-24 sau khi gom service Delivery. Full lint **chưa xanh** vì CRLF/Prettier diện rộng và sáu lỗi `unbound-method` ở test ngoài Delivery (kết quả full lint trước lần gom; scoped lint sau lần gom đạt khi tắt quy tắc Prettier). Các refactor đã commit từ Phase 1 đến Phase 5 đã loại bỏ phần lớn application port, deep import chéo feature, `forwardRef()` và phụ thuộc ngược từ infra vào business feature. Trạng thái commit của Delivery sau ngày lập báo cáo cần đối chiếu `git log`, không suy ra từ tài liệu này.

Code hiện tại **chưa đạt cấu trúc đích mới ở toàn bộ feature**. Riêng `orders` đã đạt một module,
một `public-api.ts`, controller/service theo role và không còn các module Reader/Command phụ.
`delivery` có chủ đích giữ hai module/hai public API vì Auth chỉ được phụ thuộc module hồ sơ shipper hẹp; ép về một module sẽ tạo vòng Auth–Delivery. Các feature khác cần đánh giá từng cái, không lấy số module làm mục tiêu độc lập.

Đánh giá hiện tại:

| Hạng mục | Kết luận |
| --- | --- |
| Build | Đạt |
| Full unit test | 111 suite/392 test đạt sau dọn test Delivery |
| Full integration và boundary test | 26 suite/76 test đạt; 2 suite/3 test PostgreSQL skip |
| Full E2E | 10 suite/32 test đạt |
| Không có runtime `forwardRef()` | Đạt |
| Không deep import chéo feature | Đạt theo scan hiện tại |
| Infra không import ngược feature | Đạt theo scan hiện tại |
| Không dùng application port nội bộ | Đạt |
| Một module/API cho mỗi feature | Không phải gate tuyệt đối; Delivery giữ ngoại lệ hẹp có lý do |
| Controller/service chia theo role | Đạt một phần |
| Entity đặt tập trung tại `src/entities` | Chấp nhận theo quyết định hiện tại |
| Full lint | Chưa đạt: CRLF/Prettier và 6 lỗi test ngoài Delivery |

Không có bằng chứng cho thấy cần chuyển sang microservice, monorepo hoặc viết lại toàn bộ. Modular monolith hiện tại vẫn có thể cải thiện theo từng feature.

## 2. Phạm vi và nguyên tắc kiểm tra

Báo cáo này ưu tiên theo thứ tự:

1. Code hiện tại.
2. Kết quả lệnh chạy thực tế ngày 2026-09-24 sau Delivery nhịp 4.
3. Git status và git log hiện tại.
4. Tài liệu kiến trúc.
5. Báo cáo lịch sử.

Báo cáo không coi số liệu hoặc kết luận cũ là sự thật nếu chưa kiểm chứng lại. Lần cập nhật này đã chạy full unit/integration/E2E, nhưng không xác nhận hành vi với PostgreSQL, Redis, MinIO, Mapbox, MoMo hoặc VNPay thật. Các test PostgreSQL có điều kiện vẫn skip.

## 3. Trạng thái Git

### 3.1. Các refactor đã commit

Các commit gần nhất ở HEAD trước các thay đổi Delivery hiện hành:

```text
28beed2 refactor(delivery): remove dispatch provider cycle
e85da77 refactor(orders): finish role based structure
1c664ee refactor(orders): decouple reviews and simplify analytics
2f5d943 refactor(chat): use the main orders service
6bb53e0 refactor(messenger): use the main orders service
3a574a7 refactor(notifications): consume recipient snapshots from events
2cf2a85 fix(delivery): restore missing order assignments
c183f88 refactor(orders): decouple delivery with durable status events
```

Các commit trên đã có trong `main`; `main` đang đồng bộ `origin/main` tại thời điểm kiểm tra trước đợt commit Delivery này. Snapshot working tree Delivery lúc đó gồm:

- gỡ vòng provider dispatch/shipper và gom event subscriber;
- gom tracking về customer service, assignment/completion/earnings về trip service;
- đăng ký shipper trong cùng transaction manager qua Auth/Users/Delivery;
- Worker chỉ đăng ký một `FindShipperProcessor`;
- bổ sung boundary, ownership, DI và behavior test.

### 3.2. Working tree và thay đổi ngoài phạm vi

Nhóm Delivery trong working tree **tại thời điểm audit trước commit**: `DELIVERY_REFACTORING_PLAN.md`, `src/features/delivery/**`, `src/features/auth/auth.service.ts`, `src/features/users/services/users.service.ts`, `src/worker.module.ts`, các test Delivery/Auth/Users/boundary liên quan và báo cáo này. Muốn biết nhóm này đã được push hay chưa, kiểm tra Git hiện tại.

File Backend ngoài phạm vi, được giữ nguyên:

```text
M  docker/docker-compose.yml
```

Hai ambient declaration đã được commit về đúng hạ tầng sở hữu trong lịch sử:

- Mapbox: `src/types/mapbox-directions.d.ts` → `src/infra/mapbox/mapbox-directions.d.ts`;
- Nodemailer: `src/types/nodemailer.d.ts` → `src/infra/mail/nodemailer.d.ts`.

Ngoài Backend còn có thay đổi và thư mục chưa tracked ở các project cùng repository. Chúng không thuộc phạm vi báo cáo này, không được sửa và không được stage cùng refactor Orders.

## 4. Kiểm kê code hiện tại

Số liệu lấy trực tiếp từ checkout hiện tại:

| Thành phần | Số lượng |
| --- | ---: |
| File tracked toàn repository `foodee-be` | 662 |
| File tracked trong `Backend/src` | 418 |
| File tracked trong `Backend/test` | 148 |
| Business feature trong `src/features` | 14 |
| File entity trong `src/entities` | 27 |
| Migration TypeScript | 37 |
| REST controller | 33 |
| GraphQL resolver | 5 |
| Unit test suite | 111 |
| Integration test suite | 28 (gồm 2 suite có điều kiện) |
| E2E suite | 10 |

14 feature hiện tại:

```text
analytics, auth, communications, delivery, locations, menu,
notifications, orders, payments, promotions, restaurants,
reviews, system-constraints, users
```

## 5. Ranh giới thư mục được chốt

```text
src/
├── features/      # nghiệp vụ và API theo feature
├── entities/      # TypeORM entity tập trung
├── infra/         # queue, cache, mail, map, storage, payment gateway
├── common/        # HTTP contract, request context, EventBus/Outbox, pagination
├── shared/        # pure type/enum/utility thật sự dùng chung
└── migrations/    # lịch sử thay đổi database
```

Việc cùng tồn tại `common`, `shared`, `infra`, `features` và `entities` không phải lỗi nếu trách nhiệm được giữ rõ:

- `common` không chứa nghiệp vụ của một feature cụ thể;
- `shared` không trở thành nơi chứa mọi DTO/contract;
- `infra` không import ngược `src/features/**`;
- entity tiếp tục nằm tập trung và không được export qua feature public API;
- service/repository của feature này không được thao tác repository của feature khác.

## 6. Cấu trúc feature mục tiêu

Cấu trúc đã thống nhất:

```text
src/features/<feature>/
├── controllers/       # chia theo role thật sự
├── services/          # role service và service nghiệp vụ cần thiết
├── dto/
├── types/
├── contracts/         # policy, cache key, event payload nội bộ
├── <feature>.module.ts
├── public-api.ts
└── README.md
```

Quy tắc:

- không bắt buộc tạo đủ file cho mọi role;
- chỉ tạo `public`, `customer`, `merchant`, `shipper`, `admin`, `system` khi có use case thật;
- mỗi feature chỉ có một module chính và một `public-api.ts`;
- không tạo application port, DI token hoặc `useExisting` nếu chỉ có một implementation;
- không `forwardRef()`;
- không deep import sang feature khác;
- không export controller, entity hoặc repository;
- entity vẫn ở `src/entities`, không di chuyển vào feature;
- migration vẫn ở `src/migrations`.

## 7. Mức độ phù hợp của từng feature

Số liệu dưới đây tính file TypeScript trong checkout hiện tại, kể cả file chưa commit; cột service chỉ tính `*.service.ts`, không cộng handler hoặc resolver. Các module/API hẹp có thể là ranh giới cần giữ, không tự động coi là lỗi.

| Feature | TS files | Module | Public API | Controller | Service | So với cấu trúc đích |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| analytics | 8 | 1 | 1 | 1 | 4 | Gần đạt |
| auth | 21 | 1 | 2 | 1 | 4 | Cần gộp public API |
| communications | 20 | 3 | 1 | 2 | 8 | Cần gộp module |
| delivery | 27 | 2 | 2 | 4 | 9 | Sáu service chính + profile/tracker + adapter Redis |
| locations | 13 | 3 | 2 | 1 | 1 | Cần gộp module/public API |
| menu | 30 | 3 | 1 | 4 | 8 | Cần gộp module |
| notifications | 10 | 1 | 1 | 1 | 2 | Gần đạt |
| orders | 31 | 1 | 1 | 4 | 9 | Đạt về cấu trúc và boundary; thêm 1 resolver/1 handler ngoài hai cột này |
| payments | 11 | 1 | 1 | 2 | 2 | Gần đạt |
| promotions | 11 | 1 | 1 | 2 | 3 | Đạt, feature mẫu đã hoàn thành |
| restaurants | 21 | 2 | 2 | 3 | 5 | Cần gộp module/public API |
| reviews | 9 | 1 | 1 | 2 | 1 | Gần đạt theo cấu trúc hiện tại |
| system-constraints | 3 | 1 | 1 | 0 | 1 | Đạt về cấu trúc |
| users | 35 | 6 | 4 | 4 | 5 | Chưa đạt, ưu tiên cao |

`src/features/features.module.ts` là module composition cấp ứng dụng, không tính là module riêng của một feature.

## 8. Kiểm tra boundary hiện tại

### 8.1. `forwardRef()`

Không tìm thấy lời gọi `forwardRef()` trong runtime source. Các chuỗi `forwardRef` còn lại chỉ nằm trong test dùng để bảo vệ boundary.

Trạng thái: **Đạt**.

### 8.2. Deep import giữa các feature

Scan import hiện tại không phát hiện feature A import trực tiếp `services/`, `dto/`, `types/`, `contracts/`, repository hoặc module nội bộ của feature B. Các import chéo đều đi qua một file có hậu tố `public-api`.

Trạng thái: **Đạt theo code hiện tại**.

Điểm còn nợ: một số feature vẫn có nhiều public API; với Delivery, `shipper-profile.public-api.ts` là ngoại lệ hẹp có consumer thật từ Auth, không phải lý do để gộp bằng `forwardRef()`.

### 8.3. Infra import ngược feature

Không tìm thấy import từ `src/infra/**` đến `src/features/**`.

Trạng thái: **Đạt**.

### 8.4. Application port và DI token

Không còn file application port trong `src/features` và không tìm thấy `useExisting`.

Các token còn lại:

```text
src/infra/cache/cache.constants.ts: REDIS_CLIENT
src/infra/queue/queue.constants.ts: QUEUE_INSTANCE, REGISTERED_QUEUE_NAME
```

Đây là token kỹ thuật của hạ tầng, không phải application port và được phép giữ.

`PaymentGateway` tiếp tục là contract hạ tầng hợp lệ vì có nhiều implementation thực tế: MoMo và VNPay.

Trạng thái: **Đạt**.

### 8.5. Ownership

Boundary test và scan source hiện tại xác nhận các nguyên tắc chính ở mức static:

- Chỉ Orders import/inject repository của entity `Order`; các chỗ `order.status = ...` trong demo payment sửa `DummyOrder` ở Map bộ nhớ, không phải Order lưu DB;
- Delivery sở hữu dispatch, shipper profile và trạng thái giao hàng;
- Entity giao hàng/shipper chỉ được import bởi Delivery trong các business feature; registry của hạ tầng chỉ khai báo entity cho TypeORM;
- Analytics dùng projection/read model;
- Reviews kiểm tra rules qua `OrderRulesService` trong public API chính của Orders;
- queue không phụ thuộc Delivery hoặc feature business.

Trạng thái: **Đạt ở mức source/boundary test**. `DeliveryReportService.getIncomeReport()` vẫn join quan hệ sang Order để đọc số liệu; đây là phụ thuộc đọc dữ liệu còn nợ, không phải quyền ghi Order. Test static không thay thế xác minh DB thật.

## 9. Vấn đề kiến trúc còn lại

### 9.1. Orders đã đạt cấu trúc đích, nhưng creation vẫn là hotspot

Bằng chứng hiện tại:

| File | Số dòng |
| --- | ---: |
| `services/order-creation.service.ts` | 797 |
| `services/order-rules.service.ts` | 399 |
| `services/order-delivery.service.ts` | 292 |
| `services/admin-orders.service.ts` | 256 |
| `services/merchant-orders.service.ts` | 184 |
| `services/order-events.handler.ts` | 153 |
| `services/public-orders.service.ts` | 100 |
| `services/order-messaging.service.ts` | 75 |
| `services/order-analytics.service.ts` | 54 |
| `services/customer-orders.service.ts` | 61 |

Controller đã chia thành public/customer/merchant/admin và resolver mà không đổi prefix route.
Feature hiện có đúng một `orders.module.ts`, một `public-api.ts`, 9 file `*.service.ts` và một `order-events.handler.ts` trong thư mục services.

Các module/public API Reader/Command cũ cho Delivery, Tracking và Analytics đã được xóa. Delivery,
Reviews, Analytics và Communications đều import public API chính.

`OrderCreationService` còn dài vì chứa pricing, route fallback và transaction tạo Order. Đây là
hotspot cần theo dõi, nhưng chưa có bằng chứng nên tách transaction này thành thêm nhiều file.

Trạng thái: **Đạt về cấu trúc/boundary; còn nợ giảm độ dài có điều kiện**.

### 9.2. Hướng phụ thuộc Orders đã được sửa trước khi gộp module

Orders không import `DeliveryModule` hoặc inject `DeliveryDispatchService`. Orders phát event thay
đổi trạng thái; Delivery sở hữu pending assignment và dùng `OrderDeliveryService` qua public API
chính. Vì chiều `Orders -> Delivery` đã được xóa, `DeliveryModule -> OrdersModule` không tạo cycle.

Các bước đã hoàn thành:

- thông báo sau thay đổi đi qua EventBus/Outbox;
- query đồng bộ chỉ đi một chiều từ consumer đến Orders;
- bỏ dependency ngược Orders đến Delivery/Reviews/Analytics/Communications;
- sau đó mới gộp về một module/public API mà không dùng `forwardRef()`.

### 9.3. Users/Auth còn ranh giới khó hiểu

Users có sáu module và bốn public API; Auth có hai public API. `users/public-api.ts` còn re-export `AuthGuard` và `RolesGuard` của Auth. Việc re-export API của feature khác làm mờ owner và khiến người đọc không biết nên import từ Auth hay Users.

Trạng thái: **Chưa đạt**. Ưu tiên P1 về kiến trúc.

### 9.4. Tên file chưa thống nhất

Các tên `reader`, `command`, `adapter`, `integration`, `core`, `facade` không sai tự thân, nhưng hiện được dùng nhiều hơn mức cần thiết.

Quy tắc đổi tên:

- `reader` → `query` khi đó chỉ là service đọc;
- `command` → đưa vào role service nếu chỉ phục vụ một actor;
- `facade` → bỏ nếu chỉ chuyển tiếp nguyên xi;
- `adapter` → chỉ giữ cho biên hạ tầng hoặc chuyển đổi contract thật;
- `integration` → đổi thành tên nghiệp vụ cụ thể;
- `core` → đổi thành trách nhiệm rõ như `state-machine`, `pricing`, `policy`.

### 9.5. `shared/types` cần đánh giá lại từng file

Hiện có năm file:

```text
src/shared/types/delivery/delivery-assignment.types.ts
src/shared/types/enums/auth-provider.enum.ts
src/shared/types/enums/default-role.enum.ts
src/shared/types/enums/order-status.enum.ts
src/shared/types/enums/permission.enum.ts
```

Không nên di chuyển hàng loạt. Mỗi type cần owner rõ:

- type chỉ dùng trong Delivery nên ở `features/delivery/types` hoặc `contracts`;
- `OrderStatus` về logic thuộc Orders nhưng hiện được đặt shared để tránh vòng import với persistence/legacy code;
- permission/default role/auth provider là foundational enum đang được Auth, Users và entity dùng chung.

Boundary test hiện tại đang bảo vệ các shared type này, vì vậy mọi thay đổi phải sửa code và test cùng một commit.

## 10. Bảo mật và chất lượng code

### Đã xử lý — Permission đọc promotion

Commit: `3456708 fix(backend): correct promotion access and redact order logs`

Endpoint `GET /promotions/:id` hiện yêu cầu đúng:

```ts
@Permissions(Permission.PROMOTION.READ)
```

Sau refactor, guard nằm tại `admin-promotions.controller.ts` và route không thay đổi.

### Đã xử lý — Log request body của Orders

Commit `3456708` đã bỏ log toàn bộ request body, địa chỉ tùy chỉnh, DTO tạo đơn,
payment URL và promotion code. Log mới chỉ giữ metadata tối thiểu như event, actor ID,
restaurant ID, order ID, checkout ID và số lượng item.

### P2 — Phản hồi 403/404 cần chốt theo threat model

`OrderActorPolicy` và `AddressService` dùng `ForbiddenException` khi tài nguyên tồn tại nhưng actor không sở hữu. Đây là kiểm soát BOLA đúng về chặn truy cập, nhưng có thể tiết lộ sự tồn tại của ID nếu API trả 403 khác 404.

Không nên tự động đổi toàn bộ 403 thành 404. Cần quyết định theo từng endpoint:

- endpoint lookup bằng ID không công khai: ưu tiên 404 để giảm enumeration;
- endpoint quản trị hoặc actor đã biết tài nguyên: 403 có thể phù hợp;
- giữ test cho cả owner, non-owner và missing resource.

### P2 — Lint chưa xanh

Lần chạy full lint ngày 2026-09-24 cho kết quả:

```text
15468 problems
15351 errors
117 warnings
```

Phần lớn lỗi là Prettier yêu cầu xóa CRLF. Khi chạy ESLint với riêng rule Prettier tắt trên toàn repository tại cùng checkout và chỉ hiện lỗi:

```text
6 errors
0 warnings được hiển thị do --quiet
```

Bốn lỗi nằm trong `test/unit/common/paginate.spec.ts`, hai lỗi trong `test/unit/features/promotions/promotion-controller.contract.spec.ts`, đều thuộc rule `@typescript-eslint/unbound-method`. Chúng không nằm trong phần Delivery vừa sửa. Full lint không pass; không gộp sửa lint/CRLF toàn repository vào nhịp Delivery.

Không nên chạy `lint:fix` trên toàn repository trong cùng commit refactor kiến trúc vì sẽ tạo diff CRLF rất lớn.

## 11. Kết quả lệnh chạy thực tế

### Build

```text
Lệnh: npm run build
Kết quả: PASS
Exit code: 0
```

### Unit test

```text
Lệnh: npm run test:unit
Kết quả: PASS
Test Suites: 111 passed, 111 total
Tests: 391 passed, 391 total
Thời gian Jest: 233.72 s
```

### Integration và boundary test

```text
Lệnh: npm run test:integration
Kết quả: PASS có skip
Test Suites: 26 passed, 2 skipped, 28 total
Tests: 76 passed, 3 skipped, 79 total
Thời gian Jest: 31.023 s
```

Hai suite/ba test skip là concurrency ShippingDetail và rollback đăng ký shipper trên PostgreSQL; chưa được tính là pass. Các log mức `ERROR` trong test queue, payment gateway và notification là tình huống lỗi được test chủ động; Jest vẫn kết luận pass.

### E2E

```text
Lệnh: npm run test:e2e -- --silent
Kết quả: PASS
Test Suites: 10 passed, 10 total
Tests: 32 passed, 32 total
Thời gian Jest: 89.159 s
```

Các E2E hiện tại dùng Nest TestingModule/mock, không chứng minh backend chạy với PostgreSQL/Redis thật.

Full unit/integration/E2E ở trên chạy trước chỉnh sửa metadata cuối của `WorkerModule`. Sau chỉnh sửa đó, `npm run build` và scoped ESLint đạt; ba suite boundary/composition/ownership đạt 27 test và test ownership riêng với `QUEUE_PROCESSOR_ENABLED=true` đạt 6 test. Chưa chạy lại full suite trên đúng trạng thái cuối.

### Lint

```text
Lệnh: npm run lint
Kết quả: FAIL
Nguyên nhân chính: CRLF/Prettier
```

```text
Lệnh: npx eslint "{src,test}/**/*.ts" --rule "prettier/prettier: off" --quiet
Kết quả: FAIL
6 errors được hiển thị, ở hai file test ngoài Delivery
```

### Chưa chạy

- test với database/Redis/MinIO thật;
- smoke test HTTP/GraphQL trên ứng dụng đang chạy;
- kiểm thử frontend compatibility.

Vì vậy báo cáo không kết luận production-ready.

## 12. Những kết luận cũ đã bị loại bỏ hoặc sửa

| Kết luận cũ | Đánh giá hiện tại |
| --- | --- |
| Phải chuyển entity vào từng feature | Đã bỏ. Entity tiếp tục ở `src/entities` |
| Tạo `src/common/contracts` làm nguồn chuẩn cho mọi contract | Đã bỏ. Contract nghiệp vụ ở feature owner; shared chỉ dành cho type trung lập |
| Feature phải dùng port/Symbol để giao tiếp | Đã cũ. Application port đã bỏ, dùng concrete service qua public API |
| Có hơn 25 port application | Đã cũ. Không còn port file trong feature |
| Unit test còn fail | Đã cũ. 111/111 suite pass trong lần chạy này |
| Integration test còn fail | Đã cũ. 26 pass, 2 skip, không có suite fail |
| Có 28 entity | Số file hiện tại là 27 |
| Có 85 unit suite và 22 integration suite | Hiện tại là 111 và 28 suite (gồm 2 suite PostgreSQL skip) |
| Di chuyển entity là Phase tiếp theo | Không còn trong kiến trúc mục tiêu |
| Gộp Orders/Delivery bằng direct import hai chiều | Không được phép vì sẽ tạo cycle; phải sửa hướng dependency trước |

## 13. Kế hoạch nhỏ nhất và an toàn nhất

### Bước 1 — Promotions feature mẫu — Đã hoàn thành

- đã tách `public-promotions.controller.ts` và `admin-promotions.controller.ts`;
- đã tách public/admin service và giữ `PromotionUsageService` riêng để ghi nhận lượt dùng;
- đã giữ một `promotions.module.ts` và một `public-api.ts`;
- đã sửa permission đọc promotion;
- đã giữ nguyên route, DTO và response contract;
- build, full unit và full integration đều pass.

### Bước 2 — Boundary test cho feature mẫu — Đã hoàn thành

`promotions-feature-structure.spec.ts` hiện bảo vệ:

- đúng một module chính và một `public-api.ts` cho feature đã migrate;
- không `forwardRef()`;
- không deep import chéo feature;
- không export entity/repository/controller;
- infra không import feature;
- application port không quay lại.

### Bước 3 — Refactor Orders — Đã hoàn thành về cấu trúc/boundary

Dependency graph chi tiết và thứ tự gỡ cycle được ghi tại
[`ORDERS_DEPENDENCY_GRAPH.md`](./ORDERS_DEPENDENCY_GRAPH.md).

Nhịp 1:

- [x] chia `order.controller.ts` theo customer/merchant/admin;
- [x] giảm `customer-orders.service.ts` về role orchestration;
- [x] chỉ giữ một `orders/public-api.ts`;
- [x] xóa `OrderService` facade và `OrderCoreService`.

Nhịp 2:

- [x] vẽ dependency graph Orders ↔ Delivery/Reviews/Analytics/Notifications;
- [x] chuyển subscription đăng ký active shipper sang Delivery, giữ nguyên GraphQL field và guard;
- [x] chuyển pending assignment orchestration và cleanup sang Delivery;
- [x] ghi `ORDER_STATUS_CHANGED_EVENT` bằng Outbox cùng transaction với Order và retry ở API;
- [x] phục hồi Order `confirmed` cũ bị thiếu pending assignment bằng cron idempotent của Delivery;
- [x] xóa `OrdersModule -> DeliveryModule`;
- [x] chuyển notification một chiều sang event có `customerId` snapshot và xóa
  `NotificationsModule -> OrdersModule`;
- [x] xóa `OrderMessagingReaderService`; Messenger dùng `OrderMessagingService`;
- [x] xóa `ChatOrderingService`; Chat dùng `OrderMessagingService`, vẫn xác nhận trước
  khi tạo đơn và để Orders tính lại giá;
- [x] chuyển review summary sang Reviews, cập nhật frontend gọi API riêng và xóa hoàn toàn chiều
  `Orders -> Reviews` cùng `OrderReviewReaderModule`;
- [x] làm dependency Orders–Reviews một chiều;
- [x] Analytics dùng `OrderAnalyticsService` qua public API chính;
- [x] Delivery dùng `OrderDeliveryService`; xóa toàn bộ reader/command module phụ;
- [x] cron địa chỉ tạm chuyển về Locations và payment route cũ delegate sang Payments;
- [x] còn đúng một module, một public API và 10 service trong Orders.

### Bước 4 — Users/Auth

- bỏ re-export Auth guard từ Users;
- caller import guard trực tiếp từ `auth/public-api.ts`;
- hợp nhất các identity module/API sau khi xác nhận không tạo cycle;
- giữ role/permission ownership rõ tại Users, authentication tại Auth.

### Bước 5 — Delivery — Đã triển khai nhịp 0–4 và gom service, đạt có điều kiện

Chi tiết và lệnh kiểm thử nằm ở [`DELIVERY_REFACTORING_PLAN.md`](./DELIVERY_REFACTORING_PLAN.md). Đã gỡ vòng provider dispatch/shipper, gom tracking về customer service, giữ transaction/Outbox, gom bốn subscriber vào một handler, dùng cùng transaction manager cho account/profile shipper và thêm boundary test cho entity owner. Sau nhịp 4, assignment/completion/earnings được gom vào `DeliveryTripService` với các transaction riêng; sáu service chính nằm trực tiếp dưới `services/`. `ShipperProfileService` và `ActiveShipperTrackerService` vẫn tách vì module hồ sơ hẹp và timer/trạng thái riêng. Worker chỉ đăng ký `FindShipperProcessor` một lần với cả cấu hình cờ tắt/bật. Giữ module/API hồ sơ shipper hẹp vì Auth cần nó; không dùng `forwardRef()` để đạt chỉ tiêu một module.

Sau lần gom service và dọn tên test, build, 111 suite/392 unit test, 26 suite/76 integration test và 10 suite/32 E2E test đạt; 2 suite/3 test PostgreSQL skip. Integration/E2E chạy trước khi đổi tên file unit test, không có runtime code đổi sau đó. PostgreSQL thật chưa được kiểm chứng; báo cáo thu nhập còn join Order và hủy chuyến còn khoảng hở nhiều lần ghi. Không gọi Delivery hoàn tất production; trạng thái commit/push kiểm tra bằng Git.

Các feature tiếp theo cần kiểm tra riêng: Users/Auth, Locations, Menu, Restaurants và Communications. Không trộn Docker, migration, formatting toàn repository hoặc thay đổi API behavior vào refactor Delivery.

## 14. Exit gate cho mỗi feature

Một feature chỉ được xem là hoàn thành migration khi:

- [ ] Có một module/API chính; mọi module/API hẹp thêm vào phải có consumer, hướng phụ thuộc một chiều và test chứng minh (Delivery là ngoại lệ đã ghi rõ).
- [ ] Controller/service phản ánh role thật sự.
- [ ] Không có controller/service rỗng để đủ mẫu.
- [ ] Không có `forwardRef()`.
- [ ] Không deep import feature khác.
- [ ] Không dùng repository/entity của feature khác trong service.
- [ ] Không export entity, repository hoặc controller.
- [ ] Contract nội bộ ở trong feature.
- [ ] Shared chỉ chứa type/enum/utility thật sự dùng chung.
- [ ] Route, guard, DTO và response không đổi ngoài chủ đích.
- [ ] `npm run build` pass.
- [ ] Unit test liên quan pass.
- [ ] Integration/boundary test pass.
- [ ] README feature đúng với code hiện tại và trạng thái commit/working tree được ghi rõ.

## 15. Kết luận cuối

Codebase không cần viết lại. Build, full unit, full E2E và các integration test chạy được đều qua; PostgreSQL có điều kiện chưa chạy và full lint chưa xanh. Scan source/test cho thấy không có `forwardRef`, deep import chéo feature hoặc infra phụ thuộc ngược business feature trong phạm vi đã kiểm tra.

Nợ chính bây giờ là các đường dữ liệu/transaction cụ thể, không phải số lượng file. Delivery giữ hai module/API vì ranh giới Auth an toàn hơn việc gộp hình thức. Bước nhỏ nhất tiếp theo là chạy test PostgreSQL có điều kiện trong môi trường DB phù hợp và xử lý riêng báo cáo thu nhập cùng luồng hủy chuyến; sau đó mới quyết định đóng Delivery và commit đúng phạm vi. Không tách tiếp Orders chỉ vì số dòng.
