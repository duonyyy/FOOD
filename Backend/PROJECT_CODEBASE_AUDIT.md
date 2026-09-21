# BÁO CÁO KIỂM TRA CODEBASE FOODEE BACKEND

> Repository kiểm tra: `foodee-be/Backend`
>
> Ngày cập nhật: 2026-09-21
>
> Loại kiểm tra: đọc code, kiểm tra Git, chạy build/test/lint
>
> Chuẩn cấu trúc hiện hành: `src/features/README.md`

## 1. Kết luận ngắn

Foodee Backend đang chạy được và các quality gate quan trọng về build, unit test, integration test và boundary test đều xanh. Các refactor đã commit từ Phase 1 đến Phase 5 đã loại bỏ phần lớn application port, deep import chéo feature, `forwardRef()` và phụ thuộc ngược từ infra vào business feature.

Tuy nhiên, code hiện tại **chưa đạt cấu trúc đích mới** là mỗi feature có một module chính, một `public-api.ts`, controller/service chia theo role thật sự. Một số feature vẫn giữ nhiều module đọc hẹp và nhiều public API để tránh vòng phụ thuộc cũ. `orders` và `users` là hai khu vực phức tạp nhất.

Đánh giá hiện tại:

| Hạng mục | Kết luận |
| --- | --- |
| Build | Đạt |
| Unit test | Đạt |
| Integration và boundary test | Đạt, có 1 suite/2 test được skip |
| Không có runtime `forwardRef()` | Đạt |
| Không deep import chéo feature | Đạt theo scan hiện tại |
| Infra không import ngược feature | Đạt theo scan hiện tại |
| Không dùng application port nội bộ | Đạt |
| Một module chính cho mỗi feature | Chưa đạt |
| Một public API cho mỗi feature | Chưa đạt |
| Controller/service chia theo role | Đạt một phần |
| Entity đặt tập trung tại `src/entities` | Chấp nhận theo quyết định hiện tại |
| Lint | Chưa đạt |

Không có bằng chứng cho thấy cần chuyển sang microservice, monorepo hoặc viết lại toàn bộ. Modular monolith hiện tại vẫn có thể cải thiện theo từng feature.

## 2. Phạm vi và nguyên tắc kiểm tra

Báo cáo này ưu tiên theo thứ tự:

1. Code hiện tại.
2. Kết quả lệnh chạy thực tế gần nhất, gồm lần chạy lại sau refactor Promotions ngày 2026-09-21.
3. Git status và git log hiện tại.
4. Tài liệu kiến trúc.
5. Báo cáo lịch sử.

Báo cáo không coi số liệu hoặc kết luận cũ là sự thật nếu chưa kiểm chứng lại. Lần cập nhật này không chạy E2E và không kết nối PostgreSQL, Redis, MinIO, Mapbox, MoMo hoặc VNPay thật.

## 3. Trạng thái Git

### 3.1. Các refactor đã commit

HEAD hiện tại:

```text
20b0543 refactor(promotions): organize feature by actor role
```

Các commit liên quan trực tiếp đến boundary gần nhất:

```text
20b0543 refactor(promotions): organize feature by actor role
3456708 fix(backend): correct promotion access and redact order logs
191d21b refactor(infra): colocate provider type declarations
d07f574 docs(backend): align feature architecture guidance
c35e2ee refactor(backend): complete phase 5 boundary cleanup
08794b4 refactor(backend): complete infrastructure boundary cleanup
bf5402a refactor(backend): narrow analytics order reader
8179117 refactor(backend): complete order delivery boundary
9334831 refactor(backend): decouple delivery dispatch and completion
f2799b4 refactor(backend): clarify feature read models
1536de9 refactor(backend): simplify feature contracts
```

Những commit này đã đưa code đến trạng thái hiện tại:

- application port trong business feature đã được loại bỏ;
- feature gọi nhau qua các file `*public-api.ts`;
- Orders giữ quyền cập nhật trạng thái Order;
- Delivery không dùng trực tiếp repository Order;
- Analytics đọc Orders qua reader hẹp;
- queue/cache/map/storage nằm trong `src/infra`;
- không còn runtime `forwardRef()`;
- boundary test đã được bổ sung;
- Promotions đã trở thành feature mẫu với controller/service theo role, một module và một public API.

### 3.2. Working tree chưa commit

Sau các commit trên, thay đổi chưa commit duy nhất trong Backend là:

```text
M  docker/docker-compose.yml
```

Hai ambient declaration đã được commit về đúng hạ tầng sở hữu:

- Mapbox: `src/types/mapbox-directions.d.ts` → `src/infra/mapbox/mapbox-directions.d.ts`;
- Nodemailer: `src/types/nodemailer.d.ts` → `src/infra/mail/nodemailer.d.ts`.

Ngoài Backend còn có thay đổi và thư mục chưa tracked ở các project cùng repository. Chúng không thuộc phạm vi báo cáo này và không được sửa.

## 4. Kiểm kê code hiện tại

Số liệu lấy trực tiếp từ checkout hiện tại:

| Thành phần | Số lượng |
| --- | ---: |
| File tracked toàn repository | 605 |
| File tracked trong `src` | 436 |
| File tracked trong `test` | 139 |
| Business feature trong `src/features` | 14 |
| File entity trong `src/entities` | 27 |
| Migration TypeScript | 37 |
| REST controller | 30 |
| GraphQL resolver | 5 |
| Unit test suite | 101 |
| Integration test suite | 26 |
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

Số liệu dưới đây tính các file `*.module.ts` và `*public-api.ts` nằm trong từng feature.

| Feature | TS files | Module | Public API | Controller | Service | So với cấu trúc đích |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| analytics | 8 | 1 | 1 | 1 | 4 | Gần đạt |
| auth | 21 | 1 | 2 | 1 | 4 | Cần gộp public API |
| communications | 20 | 3 | 1 | 2 | 8 | Cần gộp module |
| delivery | 31 | 2 | 2 | 4 | 14 | Cần gộp module/public API |
| locations | 13 | 3 | 2 | 1 | 1 | Cần gộp module/public API |
| menu | 30 | 3 | 1 | 4 | 8 | Cần gộp module |
| notifications | 10 | 1 | 1 | 1 | 2 | Gần đạt |
| orders | 45 | 8 | 7 | 1 | 12 | Chưa đạt, ưu tiên cao |
| payments | 11 | 1 | 1 | 2 | 2 | Gần đạt |
| promotions | 11 | 1 | 1 | 2 | 3 | Đạt, feature mẫu đã hoàn thành |
| restaurants | 21 | 2 | 2 | 3 | 5 | Cần gộp module/public API |
| reviews | 12 | 2 | 2 | 2 | 2 | Cần gộp module/public API |
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

Điểm còn nợ: nhiều feature đang có nhiều public API hẹp, nên đạt boundary cũ nhưng chưa đạt quy ước mới “một public API”.

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

Boundary test hiện tại xác nhận các nguyên tắc chính:

- Orders sở hữu cập nhật trạng thái Order;
- Delivery sở hữu dispatch, shipper profile và trạng thái giao hàng;
- Analytics dùng projection/read model;
- Reviews kiểm tra eligibility qua API hẹp của Orders;
- queue không phụ thuộc Delivery hoặc feature business.

Trạng thái: **Đạt theo test hiện tại**.

## 9. Vấn đề kiến trúc còn lại

### 9.1. Orders còn quá lớn

Bằng chứng hiện tại:

| File | Số dòng |
| --- | ---: |
| `services/customer-orders.service.ts` | 949 |
| `controllers/order.controller.ts` | 498 |
| `services/order-core.service.ts` | 435 |
| `services/admin-orders.service.ts` | 275 |
| `services/order.service.ts` | 198 |
| `services/merchant-orders.service.ts` | 184 |
| `controllers/order.resolver.ts` | 161 |
| `services/order-events.handler.ts` | 153 |
| `services/order-cross-feature.adapters.ts` | 148 |

Ngoài module chính, Orders còn bảy module reader/command hẹp và sáu public API phụ. Điều này từng giúp phá vòng phụ thuộc, nhưng làm người đọc khó biết API nào là chuẩn.

`orders/public-api.ts` cũng đang export quá rộng: nhiều DTO, role service, core service, state machine, policy, adapter và helper. Đây chưa phải public API hẹp.

Trạng thái: **Chưa đạt**. Ưu tiên P1 về maintainability.

### 9.2. Không thể gộp module Orders một cách máy móc

Hiện tại Orders import `DeliveryModule`, trong khi Delivery dùng các module reader hẹp của Orders. Nếu xóa reader module và cho Delivery import trực tiếp `OrdersModule`, vòng phụ thuộc `OrdersModule ↔ DeliveryModule` sẽ quay lại.

Muốn đạt một module mà vẫn không dùng `forwardRef()`, cần sửa hướng giao tiếp trước:

- chuyển thông báo sau thay đổi sang EventBus/Outbox;
- giữ query đồng bộ theo một chiều;
- bỏ dependency ngược không cần thiết;
- sau khi dependency graph một chiều mới gộp module/public API.

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

Lần chạy full lint ngày 2026-09-18 cho kết quả:

```text
23220 problems
23120 errors
100 warnings
```

Phần lớn lỗi là Prettier yêu cầu xóa CRLF. Khi chạy ESLint với rule Prettier tắt trên
toàn repository tại cùng baseline:

```text
104 problems
4 errors
100 warnings
```

Bốn lỗi thật hiện nằm trong `test/unit/common/paginate.spec.ts` do rule `@typescript-eslint/unbound-method`. Các warning chủ yếu là `any`, unsafe access và async không có `await` trong test hoặc một số service.

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
Test Suites: 101 passed, 101 total
Tests: 345 passed, 345 total
Thời gian Jest: 125.362 s
```

### Integration và boundary test

```text
Lệnh: npm run test:integration
Kết quả: PASS có skip
Test Suites: 25 passed, 1 skipped, 26 total
Tests: 64 passed, 2 skipped, 66 total
Thời gian Jest: 65.393 s
```

Các log mức `ERROR` trong test queue, payment gateway và notification là tình huống lỗi được test chủ động; Jest vẫn kết luận pass.

### Lint

```text
Lệnh: npm run lint
Kết quả: FAIL
Nguyên nhân chính: CRLF/Prettier
```

```text
Lệnh: npx eslint "{src,test}/**/*.ts" --rule "prettier/prettier: off"
Kết quả: FAIL
4 errors, 100 warnings
```

### Chưa chạy

- `npm run test:e2e`;
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
| Unit test còn fail | Đã cũ. 101/101 suite pass trong lần chạy này |
| Integration test còn fail | Đã cũ. 25 pass, 1 skip, không có suite fail |
| Có 28 entity | Số file hiện tại là 27 |
| Có 85 unit suite và 22 integration suite | Hiện tại là 101 và 26 |
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

### Bước 3 — Refactor Orders theo hai nhịp — Bước tiếp theo

Nhịp 1:

- chia `order.controller.ts` theo customer/merchant/admin;
- giảm `customer-orders.service.ts` bằng service nghiệp vụ có tên rõ;
- thu hẹp export của `orders/public-api.ts`;
- bỏ facade chuyển tiếp nếu không có logic.

Nhịp 2:

- vẽ dependency graph Orders ↔ Delivery/Reviews/Analytics/Notifications;
- chuyển notification một chiều sang event;
- làm query dependency một chiều;
- chỉ sau đó mới gộp các reader module/public API phụ.

### Bước 4 — Users/Auth

- bỏ re-export Auth guard từ Users;
- caller import guard trực tiếp từ `auth/public-api.ts`;
- hợp nhất các identity module/API sau khi xác nhận không tạo cycle;
- giữ role/permission ownership rõ tại Users, authentication tại Auth.

### Bước 5 — Các feature còn lại

Thực hiện lần lượt Delivery, Locations, Menu, Restaurants, Reviews và Communications. Mỗi feature một commit, không trộn Docker, migration, formatting toàn repository hoặc thay đổi API behavior.

## 14. Exit gate cho mỗi feature

Một feature chỉ được xem là hoàn thành migration khi:

- [ ] Có đúng một module chính.
- [ ] Có đúng một `public-api.ts`.
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
- [ ] README feature đúng với code đã commit.

## 15. Kết luận cuối

Codebase không cần viết lại. Boundary runtime hiện tại tốt hơn báo cáo cũ mô tả: build và test xanh, không có `forwardRef`, không có deep import chéo feature và infra không phụ thuộc business feature.

Nợ chính bây giờ là **độ phức tạp cấu trúc**, không phải hệ thống mất kiểm soát runtime. Promotions đã chứng minh cấu trúc role-based có thể áp dụng mà không đổi route hoặc phá test. Bước tiếp theo là lập dependency graph cho Orders rồi refactor theo hai nhịp; không xóa các reader module trước khi sửa được hướng phụ thuộc Orders–Delivery.
