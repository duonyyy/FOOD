# Orders Dependency Graph

Ngày kiểm tra: 2026-09-22
Code tham chiếu: commit `2f5d943` và working tree của nhịp Orders–Reviews

## 1. Kết luận ngắn

`orders` chưa thể chuyển ngay thành một module duy nhất và một public API duy nhất vì Delivery và
Analytics vẫn dùng các API hẹp. Tuy nhiên, các quan hệ hai chiều Orders–Delivery và Orders–Reviews
đã được gỡ mà không dùng `forwardRef()`.

Review summary hiện thuộc Reviews. Client đọc Order và review summary bằng hai request rồi ghép ở
lớp API frontend. Reviews chỉ đọc review context tối thiểu từ Orders để kiểm tra actor và trạng thái.

## 2. Phạm vi và số liệu hiện tại

Phạm vi kiểm tra:

- `src/features/orders/**`;
- các feature import từ Orders;
- các feature được Orders import trực tiếp;
- EventBus/Outbox liên quan vòng đời Order.

Hiện trạng:

| Thành phần                           | Số lượng |
| ------------------------------------ | -------: |
| TypeScript files trong Orders        |       48 |
| NestJS modules                       |        8 |
| Public API files                     |        7 |
| Controller/Resolver                  |        5 |
| File service có hậu tố `.service.ts` |       12 |
| `forwardRef()` trong Orders          |        0 |

Các hotspot lớn:

| File                              | Số dòng | Nhận xét                                                   |
| --------------------------------- | ------: | ---------------------------------------------------------- |
| `customer-orders.service.ts`      |     946 | Trộn tính giá, địa chỉ tạm, tạo đơn, lịch sử và thanh toán |
| `order-core.service.ts`           |     413 | Trộn state machine, pricing, policy và query/presentation  |
| `admin-orders.service.ts`         |     256 | Có Order state, payment timeout và operational command     |
| `customer-orders.controller.ts`   |     275 | Đã tách route customer nhưng vẫn còn nhiều use case        |
| `order.service.ts`                |     240 | Chủ yếu là facade chuyển tiếp sang ba role service         |
| `merchant-orders.service.ts`      |     184 | Order state và phát event sau khi đổi trạng thái           |
| `order-events.handler.ts`         |     153 | Bốn event handler khác mục đích trong một file             |
| `order-analytics.service.ts`      |      54 | Cung cấp dữ liệu Order tối thiểu cho Analytics             |

## 3. Dependency graph hiện tại

```mermaid
flowchart LR
  Orders --> Auth[Auth]
  Orders --> Users[Users]
  Orders --> Locations[Locations]
  Orders --> Menu[Menu]
  Orders --> Promotions[Promotions]
  Orders --> Restaurants[Restaurants]
  Orders --> Constraints[System Constraints]
  Orders -->|checkout commands| Payments[Payments]
  Payments[Payments] -->|payment.succeeded event| Orders

  Delivery -->|narrow readers and lifecycle command| Orders

  Reviews -->|OrderRules qua public API| Orders

  Orders -->|order.created and notification events| EventBus[EventBus / Outbox]
  EventBus --> Analytics
  EventBus --> Notifications
  EventBus --> Delivery

  Analytics -->|OrdersModule / OrderAnalyticsService| Orders
  Notifications -->|event recipient data| EventBus
  Communications -->|OrdersModule / chat services| Orders
```

Mũi tên trong sơ đồ thể hiện hướng phụ thuộc của code hoặc event consumer, không phải ownership của
dữ liệu.

## 4. Orders phụ thuộc ra ngoài

| Feature/hạ tầng    | Orders đang dùng                                                    | Loại              | Boundary hiện tại             | Đánh giá                                                      |
| ------------------ | ------------------------------------------------------------------- | ----------------- | ----------------------------- | ------------------------------------------------------------- |
| Auth               | Module, guard và permission decorator                               | Hỗ trợ API        | Public API                    | Hợp lệ                                                        |
| Users              | Current actor và identity query                                     | Read              | Public API                    | Hợp lệ                                                        |
| Locations          | Đọc, tạo và xóa địa chỉ tạm                                         | Read/write        | Public API                    | Hợp lệ nhưng `CustomerOrdersService` đang điều phối quá nhiều |
| Menu               | Snapshot món/topping để tính giá                                    | Read              | Public API                    | Hợp lệ                                                        |
| Promotions         | Kiểm tra rules và ghi usage trong transaction                       | Read/write        | Public API                    | Hợp lệ; transaction boundary nằm ở tạo Order                  |
| Restaurants        | Đọc quán đang hoạt động và tìm quán theo chủ                        | Read              | Public API                    | Hợp lệ                                                        |
| System Constraints | Phí giao hàng và giới hạn thời gian/khoảng cách                     | Read              | Public API                    | Hợp lệ                                                        |
| Mapbox             | Khoảng cách và thời gian giao                                       | Infra query       | `src/infra/mapbox/public-api` | Hợp lệ                                                        |
| Payments           | Tạo checkout, hủy checkout pending                                  | Command           | Public API                    | Một chiều và chưa tạo cycle                                   |
| Delivery           | Phát sự kiện trạng thái Order để Delivery đồng bộ assignment       | Async event       | Common EventBus               | Không còn import hoặc inject Delivery trong Orders            |
| EventBus/Outbox    | Order created, payment/delivery/assignment events                   | Async integration | Common events                 | Hợp lệ cho thay đổi trạng thái và retry-sensitive flow        |

### Bằng chứng quan trọng

- `orders.module.ts` không còn import `DeliveryModule` hoặc module của Reviews; vẫn import
  `PaymentModule` và `PromotionsModule`.
- `merchant-orders.controller.ts`, `admin-orders.service.ts` và `merchant-orders.service.ts` không
  còn import hoặc inject `DeliveryDispatchService`.
- Subscription đăng ký active shipper đã được chuyển từ `order.resolver.ts` sang
  `delivery/controllers/shipper.resolver.ts`. Delivery dùng kiểu GraphQL qua
  `order-delivery-shipper.public-api.ts`, không import trực tiếp Order entity.
- `order-core.service.ts` không còn đọc Review hoặc gắn `reviewInfo` vào Order response.
- `CustomerReviewsService` tạo review summary qua context tối thiểu do Orders cung cấp; mọi query
  Review đều nằm trong Reviews và được giới hạn theo `orderId`.
- `customer-orders.service.ts` tạo `ORDER_CREATED_EVENT` trong Outbox và dùng
  `PromotionUsageService` trong cùng transaction.

## 5. Các feature phụ thuộc vào Orders

| Consumer                 | API/module Orders đang dùng                        | Mục đích                                                            | Read/write     | Đánh giá                                                   |
| ------------------------ | -------------------------------------------------- | ------------------------------------------------------------------- | -------------- | ---------------------------------------------------------- |
| Delivery                 | 4 reader modules và 1 lifecycle command module     | Dispatch, tracking, shipper views, completion và cập nhật lifecycle | Read + command | Ownership đúng: Order status vẫn do Orders quyết định      |
| Analytics                | `OrdersModule` và `OrderAnalyticsService`          | Project/reconcile dữ liệu Order                                     | Read           | Dùng public API chính; không dùng Order repository         |
| Reviews                  | `OrdersModule` và `OrderReviewRulesService`        | Kiểm tra quyền tạo/xem review summary theo Order                    | Read/policy    | Một chiều Reviews -> Orders; dùng public API chính         |
| Notifications            | Event mang `customerId`                              | Tạo notification từ snapshot của producer                            | Event          | Đã tách khỏi `OrdersModule`                                      |
| Communications/Messenger | `OrdersModule` và `OrderService`                   | Kiểm tra quyền chat theo Order                                      | Read           | Đã xóa messaging service trung gian; dùng public service chính |
| Communications/Chat      | `OrdersModule` và `OrderService`                    | Xem đơn gần đây và tạo đơn từ chat                                  | Read + command | Đã xóa adapter riêng; dùng public service chính            |
| App composition          | `OrdersModule`                                     | Gắn HTTP/GraphQL API                                                | Composition    | Hợp lệ                                                     |

Không tìm thấy consumer nào inject trực tiếp Order repository từ feature khác trong các đường dẫn
trên.

## 6. Hai vòng phụ thuộc cần xử lý

### 6.1. Orders và Delivery

Hiện tại sau bước 2:

```text
Orders -> ORDER_STATUS_CHANGED_EVENT -> Delivery pending assignment
Delivery -> narrow Orders readers/lifecycle commands -> Orders
```

Orders không biết `DeliveryModule` hoặc `DeliveryDispatchService`. Delivery vẫn dùng các module hẹp
của Orders vì Delivery cần đọc snapshot và yêu cầu Orders thực hiện lifecycle command. Không được
gộp các module hẹp vào `OrdersModule` ngay vì sẽ tạo lại:

```text
OrdersModule -> DeliveryModule -> OrdersModule
```

Không được giải quyết bằng `forwardRef()`.

Hướng sửa đề xuất:

1. Di chuyển subscription đăng ký active shipper sang Delivery. **Đã hoàn thành.**
2. Orders phát `ORDER_STATUS_CHANGED_EVENT`; Delivery tự tạo hoặc xóa pending assignment.
   **Đã hoàn thành.**
3. Cleanup assignment hết hạn thuộc `DeliveryDispatchService`; Orders chỉ cung cấp lifecycle command
   hẹp để tự quyết định có hủy Order hay không. **Đã hoàn thành.**
4. Xóa `DeliveryModule` khỏi `OrdersModule`. **Đã hoàn thành.**

`ORDER_STATUS_CHANGED_EVENT` được ghi vào Outbox trong cùng transaction với thay đổi Order. API
process dispatch sau commit và retry các row `pending`/`failed`; queue worker không được đánh dấu
event là `published`. Outbox cũng từ chối hoàn tất nếu process dispatcher không có subscriber.

### 6.2. Orders và Reviews

Hiện tại:

```text
Reviews -> OrdersModule / OrderReviewRulesService
Frontend -> Orders API + Reviews summary API
```

`OrderReviewReaderModule`, `OrderReviewReaderService` và `review-reader.public-api.ts` đã được xóa.
Endpoint mới `GET /reviews/orders/:orderId/summary` giữ dữ liệu review trong feature Reviews và dùng
JWT actor để chống đọc Order không liên quan. Frontend giữ nguyên `AdminOrderDetail.reviewInfo` bằng
cách ghép response ở lớp API, nên trang chi tiết không cần đổi UI.

## 7. Ownership sau refactor phải giữ nguyên

| Nghiệp vụ                                                   | Owner duy nhất |
| ----------------------------------------------------------- | -------------- |
| Trạng thái và state machine của Order                       | Orders         |
| Tính giá Order server-side                                  | Orders         |
| Snapshot OrderItem                                          | Orders         |
| Chuyến giao, pending assignment, shipper và delivery status | Delivery       |
| Checkout và gateway payment                                 | Payments       |
| Promotion rules và usage                                    | Promotions     |
| Review và review summary                                    | Reviews        |
| Analytics projection                                        | Analytics      |

Delivery được yêu cầu thay đổi Order thông qua command/event thuộc Orders; Delivery không tự ghi
Order repository. Ngược lại, Orders không được quản lý pending assignment hoặc active shipper sau
khi gỡ dependency.

## 8. Kế hoạch refactor Orders theo hai nhịp

### Nhịp 1 — Làm code dễ đọc, không đổi dependency — Đã hoàn thành

Mục tiêu:

- tách `order.controller.ts` theo actor;
- giữ nguyên route, DTO, guard, response và service hiện tại;
- không xóa module/public API hẹp;
- không thay đổi database hoặc event contract.

Cấu trúc controller đề xuất:

```text
controllers/
├── public-orders.controller.ts
├── customer-orders.controller.ts
├── merchant-orders.controller.ts
├── admin-orders.controller.ts
└── order.resolver.ts
```

Public controller chỉ chứa ba route thực sự đang public; không tạo shipper controller rỗng. GraphQL
subscription thuộc shipper đã được chuyển sang Delivery ở bước đầu Nhịp 2.

Exit gate:

- route/guard contract test pass;
- authorization/BOLA test pass;
- build, Orders unit và integration test pass;
- không có `forwardRef` hoặc cross-feature deep import mới.

### Nhịp 2 — Sửa hướng phụ thuộc

Thứ tự:

1. Chuyển active shipper subscription sang Delivery. **Đã hoàn thành.**
2. Chuyển pending-assignment orchestration sang Delivery. **Đã hoàn thành.**
3. Xóa `OrdersModule -> DeliveryModule`. **Đã hoàn thành.**
4. Phục hồi Order `confirmed` bị thiếu pending assignment. **Đã hoàn thành.**
5. Tách Notifications khỏi broad `OrdersModule`. **Đã hoàn thành.**
6. Xóa `OrderMessagingReaderService`; Messenger dùng `OrderService`. **Đã hoàn thành.**
7. Thu hẹp Chat và xóa `ChatOrderingService` trung gian. **Đã hoàn thành.**
8. Chuyển review summary sang Reviews và xóa chiều `Orders -> Reviews`. **Đã hoàn thành.**
9. Chỉ xóa module/public API hẹp khi `rg` xác nhận không còn consumer.

Exit gate:

- feature graph không còn `Orders -> Delivery`;
- Delivery vẫn không inject Order repository;
- Orders vẫn là nơi duy nhất cập nhật Order status;
- assignment, completion, payment, notification và analytics regression test pass;
- không dùng `forwardRef()`.

## 9. Quyết định contract đã xác minh

Frontend cần `reviewInfo` để hiện thao tác đánh giá món và shipper, nhưng không bắt buộc Backend trả
review summary trong cùng response Order. Lớp API frontend gọi riêng Orders và Reviews rồi giữ nguyên
kiểu dữ liệu mà trang chi tiết đang nhận.

Tương tự, mục tiêu “một module, một public API” là mục tiêu về khả năng đọc code, không phải luật
cao hơn ownership. Nếu việc gộp tạo dependency hai chiều thì boundary hẹp phải được giữ lại cho đến
khi hướng phụ thuộc được sửa.

## 10. Bước triển khai nhỏ nhất tiếp theo

Nhịp 1 đã tách `order.controller.ts` thành public/customer/merchant/admin controller, giữ nguyên
toàn bộ route và service call.

Delivery đã có cron phục hồi Order `confirmed` bị thiếu pending assignment. Cron chỉ chạy ở API,
đọc ID qua reader hẹp của Orders và dùng thao tác tạo idempotent của Delivery.

Notifications đã dùng `customerId` snapshot trong Payment/Delivery event và không còn import
`OrdersModule` hay `OrderNotificationReaderAdapter`.

Messenger và Chat đã dùng `OrderService`; các service trung gian riêng cho hai consumer này đã
được xóa mà không tạo module/public API mới. Chat vẫn bắt buộc xác nhận trước khi tạo đơn, truyền
customer từ phiên đăng nhập và để Orders tính lại giá phía server.

Bước Analytics đã hoàn thành: `OrderAnalyticsService` nằm trong module/public API chính, còn
Analytics không import module reader hoặc adapter riêng. Bước nhỏ nhất tiếp theo là tách phần tạo
Order lớn khỏi `CustomerOrdersService` vào `OrderCreationService`, nhưng chỉ sau khi migration
Orders–Reviews hiện tại đã được kiểm tra và đóng gói riêng.

Không thực hiện đồng thời việc gộp module, đổi event, đổi schema hoặc format toàn repository trong
commit này.
