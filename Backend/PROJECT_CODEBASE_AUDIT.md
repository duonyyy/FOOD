# BÁO CÁO KIỂM TRA CODEBASE FOODEE BACKEND

> Repository kiểm tra: `foodee-be/Backend`
>
> Ngày cập nhật: 2026-09-23
>
> Loại kiểm tra: đọc code, kiểm tra Git, chạy build/scoped lint/unit/integration/E2E liên quan
>
> Chuẩn cấu trúc hiện hành: `src/features/README.md`

## 1. Kết luận ngắn

Foodee Backend đang chạy được và các quality gate quan trọng về build, unit test, integration test và boundary test đều xanh. Các refactor đã commit từ Phase 1 đến Phase 5 đã loại bỏ phần lớn application port, deep import chéo feature, `forwardRef()` và phụ thuộc ngược từ infra vào business feature.

Code hiện tại **chưa đạt cấu trúc đích mới ở toàn bộ feature**. Riêng `orders` đã đạt một module,
một `public-api.ts`, controller/service theo role và không còn các module Reader/Command phụ.
`users`, `delivery`, `locations`, `menu`, `restaurants` và `reviews` vẫn còn cấu trúc cần gộp.

Đánh giá hiện tại:

| Hạng mục | Kết luận |
| --- | --- |
| Build | Đạt |
| Unit test liên quan Orders/Delivery/Analytics/Reviews/Locations/Payment | Đạt |
| Integration và boundary test | 26 suite đạt, 1 suite/2 test skip |
| E2E Orders và Delivery tracking | 2 suite, 8 test đạt |
| Không có runtime `forwardRef()` | Đạt |
| Không deep import chéo feature | Đạt theo scan hiện tại |
| Infra không import ngược feature | Đạt theo scan hiện tại |
| Không dùng application port nội bộ | Đạt |
| Một module chính cho mỗi feature | Chưa đạt |
| Một public API cho mỗi feature | Chưa đạt |
| Controller/service chia theo role | Đạt một phần |
| Entity đặt tập trung tại `src/entities` | Chấp nhận theo quyết định hiện tại |
| Scoped lint trên file refactor | Đạt |

Không có bằng chứng cho thấy cần chuyển sang microservice, monorepo hoặc viết lại toàn bộ. Modular monolith hiện tại vẫn có thể cải thiện theo từng feature.

## 2. Phạm vi và nguyên tắc kiểm tra

Báo cáo này ưu tiên theo thứ tự:

1. Code hiện tại.
2. Kết quả lệnh chạy thực tế gần nhất sau refactor Orders ngày 2026-09-23.
3. Git status và git log hiện tại.
4. Tài liệu kiến trúc.
5. Báo cáo lịch sử.

Báo cáo không coi số liệu hoặc kết luận cũ là sự thật nếu chưa kiểm chứng lại. Lần cập nhật này đã
chạy E2E Orders/Delivery tracking nhưng không kết nối PostgreSQL, Redis, MinIO, Mapbox, MoMo hoặc
VNPay thật.

## 3. Trạng thái Git

### 3.1. Các refactor đã commit

Các commit boundary và Orders gần nhất trước lần hoàn thiện này:

```text
1c664ee refactor(orders): decouple reviews and simplify analytics
2f5d943 refactor(chat): use the main orders service
6bb53e0 refactor(messenger): use the main orders service
3a574a7 refactor(notifications): consume recipient snapshots from events
2cf2a85 fix(delivery): restore missing order assignments
c183f88 refactor(orders): decouple delivery with durable status events
```

Refactor hoàn thiện Orders được đóng gói trong cùng commit với tài liệu này. Trạng thái sau refactor:

- application port trong business feature đã được loại bỏ;
- feature gọi nhau qua các file `*public-api.ts`;
- Orders giữ quyền cập nhật trạng thái Order;
- Delivery không dùng trực tiếp repository Order;
- Analytics đọc Orders qua public API hẹp;
- queue/cache/map/storage nằm trong `src/infra`;
- không còn runtime `forwardRef()`;
- boundary test đã được bổ sung;
- Orders và Promotions dùng controller/service theo role, một module và một public API.

### 3.2. Thay đổi ngoài phạm vi được giữ nguyên

File Backend không thuộc refactor Orders và không được đưa vào commit này:

```text
M  docker/docker-compose.yml
```

Hai ambient declaration đã được commit về đúng hạ tầng sở hữu:

- Mapbox: `src/types/mapbox-directions.d.ts` → `src/infra/mapbox/mapbox-directions.d.ts`;
- Nodemailer: `src/types/nodemailer.d.ts` → `src/infra/mail/nodemailer.d.ts`.

Ngoài Backend còn có thay đổi và thư mục chưa tracked ở các project cùng repository. Chúng không thuộc phạm vi báo cáo này, không được sửa và không được stage cùng refactor Orders.

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
| orders | 31 | 1 | 1 | 5 | 10 | Đạt về cấu trúc và boundary |
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
- Reviews kiểm tra rules qua `OrderReviewRulesService` trong public API chính của Orders;
- queue không phụ thuộc Delivery hoặc feature business.

Trạng thái: **Đạt theo test hiện tại**.

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
Feature hiện có đúng một `orders.module.ts`, một `public-api.ts` và 10 file service đã thống nhất.

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

Nợ chính bây giờ là **độ phức tạp cấu trúc ở các feature còn lại**, không phải hệ thống mất kiểm
soát runtime. Promotions và Orders đã chứng minh cấu trúc role-based có thể áp dụng mà không cần
port trung gian, `forwardRef()` hoặc deep import. Orders đã hoàn thành một module/public API,
ownership Delivery/Reviews/Payments/Locations rõ hơn và Outbox vẫn được giữ cho luồng cần retry.
Bước tiếp theo nên là inventory Users/Auth hoặc Delivery; không tách tiếp Orders chỉ vì số dòng.
