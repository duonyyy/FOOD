# Kế hoạch hoàn thiện feature Orders

Ngày lập kế hoạch: 2026-09-22

## 1. Kết luận

Không nên viết lại Orders trong một lần. Cách an toàn nhất là giữ nguyên API và nghiệp vụ, tách từng nhóm trách nhiệm, chuyển từng consumer sang tên mới, rồi chỉ xóa lớp cũ khi không còn nơi sử dụng.

Kết quả cuối cùng cần đạt:

- Chỉ còn một `orders.module.ts` và một `public-api.ts`.
- Không còn `Reader`, `Command`, `Adapter`, `Core` hoặc `Facade` trong tên public của Orders.
- Không có `forwardRef` và không có deep import giữa các feature.
- Orders là nơi duy nhất thay đổi `Order.status`.
- Delivery chỉ quản lý chuyến giao, shipper và `Delivery.status`.
- Analytics, Reviews, Chat, Messenger và Delivery chỉ dùng service được export bởi `src/features/orders/public-api.ts`.
- Controller và service theo role vẫn dễ tìm; logic nghiệp vụ lớn được tách thành service có tên rõ ràng.
- Không chuyển entity ra khỏi `src/entities` trong đợt này.
- Không đổi route, DTO response, GraphQL contract hoặc database schema nếu không có lý do nghiệp vụ và test riêng.

Đây vẫn là modular monolith. Chưa có bằng chứng cần microservice, monorepo hoặc viết lại toàn bộ dự án.

## 2. Sự thật của code hiện tại

### Điểm đã tốt

- Controller đã chia theo role: public, customer, merchant và admin.
- Orders không còn cần import Delivery để cập nhật trạng thái giao hàng.
- `Order.status` vẫn được thay đổi ở phía Orders.
- EventBus và Outbox đang bảo vệ các luồng cần transaction/retry; không nên xóa chỉ để giảm số file.
- Reviews đang được chuyển sang dùng `OrderReviewRulesService` qua public API chính của Orders.

### Điểm còn phức tạp

- Orders còn nhiều module và public API phụ cho Analytics, Tracking và Delivery.
- Còn các tên khó đọc: `Reader`, `Command`, `Adapter`, `Core` và `Facade`.
- `customer-orders.service.ts` đang gom tính giá, route, promotion, tạo order, lịch sử, đặt lại, địa chỉ tạm và payment cũ.
- `order-core.service.ts` đang trộn status rules, pricing, authorization, chi tiết order, analytics và messaging.
- `order.service.ts` là lớp trung gian lớn, làm consumer khó biết service nào thật sự sở hữu nghiệp vụ.
- Test boundary hiện tại còn bảo vệ kiến trúc cũ có `Reader` và module hẹp; phải cập nhật test cùng từng nhịp.

## 3. Cấu trúc đích

```text
src/features/orders/
├── controllers/
│   ├── public-orders.controller.ts
│   ├── customer-orders.controller.ts
│   ├── merchant-orders.controller.ts
│   ├── admin-orders.controller.ts
│   └── order.resolver.ts
├── services/
│   ├── public-orders.service.ts
│   ├── customer-orders.service.ts
│   ├── merchant-orders.service.ts
│   ├── admin-orders.service.ts
│   ├── order-creation.service.ts
│   ├── order-rules.service.ts
│   ├── order-delivery.service.ts
│   ├── order-analytics.service.ts
│   ├── order-messaging.service.ts
│   └── order-events.handler.ts
├── dto/
├── types/
├── contracts/
├── orders.module.ts
├── public-api.ts
└── README.md
```

Đây là cấu trúc đích, không phải yêu cầu tạo ngay mọi file. Chỉ tạo service khi chuyển được một trách nhiệm thật sự vào đó. Không tạo file rỗng cho đủ cấu trúc.

## 4. Quy tắc đặt tên

| Tên hiện tại | Tên đích | Ý nghĩa |
|---|---|---|
| `OrderAnalyticsReaderAdapter` | `OrderAnalyticsService` | Dùng `getOrderData` và `listOrderData`; không đưa Reader/Adapter/Snapshot vào API |
| `OrderTrackingReaderService` | Phần tracking của `OrderDeliveryService` | Kiểm tra customer có quyền xem tracking |
| Các `OrderDelivery*ReaderService` | `OrderDeliveryService` | Cung cấp các thao tác phía Order mà Delivery cần |
| `OrderDeliveryLifecycleCommandService` | `OrderDeliveryService` | Trạng thái Order vẫn do Orders thay đổi |
| `OrderDeliveryAssignmentCommandService` | Phần nội bộ của `OrderDeliveryService` | Có thể giữ hàm nội bộ riêng nếu transaction lớn, nhưng không export tên Command |
| `OrderStateMachine` | Phần status của `OrderRulesService` | Quy tắc chuyển trạng thái Order |
| `OrderActorPolicy` | Phần access của `OrderRulesService` | Quy tắc ai được xem/thao tác Order |
| `OrderReviewRulesService` | Phần review của `OrderRulesService` | Điều kiện review vẫn do Orders xác nhận |
| `OrderCoreService` | Tách thành service rõ nghĩa | Không tạo một Core mới |
| `OrderService` | Xóa sau khi migrate hết consumer | Chỉ giữ tạm làm lớp tương thích trong quá trình tách |

Không đổi tên cột database/migration có chữ `snapshot` chỉ vì lý do thẩm mỹ. Đó là dữ liệu lịch sử tại thời điểm đặt hàng; đổi tên cột làm tăng rủi ro nhưng không cải thiện boundary.

## 5. Ownership bắt buộc

### Orders sở hữu

- Tạo Order và OrderDetail.
- Tính tiền tại thời điểm đặt hàng.
- Kiểm tra và thay đổi `Order.status`.
- Lưu outbox event liên quan đến thay đổi Order.
- Kiểm tra ai được xem/thao tác Order.
- Cung cấp dữ liệu Order cho feature khác qua một public API.

### Orders không sở hữu

- Delivery trip, shipper và `Delivery.status`.
- Review và nội dung review.
- Bản ghi sử dụng promotion.
- Vòng đời Address nội bộ của Locations.
- Payment gateway và thông tin thẻ.
- Queue, cache, storage hoặc map implementation.

### Quy tắc import

- Feature khác chỉ import `src/features/orders/public-api`.
- Orders chỉ import public API của feature khác; không import repository/entity/service nội bộ của feature khác.
- `src/infra/**` không import ngược `src/features/**`.
- Nếu xuất hiện cycle, sửa hướng dependency hoặc dùng event đã có; không thêm `forwardRef` và không tạo lại module hẹp chỉ để che cycle.

## 6. Lộ trình thực hiện

### Cổng 0 — Đóng gói phần Orders–Reviews đang dở

Mục tiêu: không trộn migration hiện tại với đợt đổi Analytics/Delivery.

Việc làm:

1. Review riêng diff Backend và Frontend hiện tại.
2. Xác nhận endpoint `GET /reviews/orders/:orderId/summary` và logic ghép `reviewInfo` ở Frontend.
3. Chạy lại build, test Orders/Reviews, E2E và boundary test.
4. Commit Backend và Frontend riêng; chỉ push khi được yêu cầu.
5. Không stage Docker, các thư mục AI/reference và thay đổi giao diện không thuộc nhịp này.

Exit gate:

- Hai repo có commit độc lập; working tree chỉ còn thay đổi không liên quan của người dùng.
- Orders không import Reviews.
- Build và test liên quan có bằng chứng lệnh chạy thực tế.

### Nhịp 1 — Đơn giản hóa Analytics

Mục tiêu: chỉ dùng tên `order-analytics` và bỏ module/public API phụ.

Việc làm:

1. Tạo `OrderAnalyticsService` từ logic đang nằm trong `OrderCoreService` và `OrderAnalyticsReaderAdapter`.
2. Dùng method dễ hiểu: `getOrderData` và `listOrderData`.
3. Đăng ký/export service trong `OrdersModule` và `orders/public-api.ts`.
4. Cho `AnalyticsModule` import `OrdersModule` từ public API chính.
5. Chuyển projection/reconciliation sang inject `OrderAnalyticsService`.
6. Xóa `order-analytics-reader.module.ts`, `order-analytics-reader.public-api.ts` và `order-cross-feature.adapters.ts` khi không còn dùng.
7. Cập nhật public-contract và ownership test theo kiến trúc mới.

Exit gate:

- `rg "OrderAnalyticsReader|order-analytics-reader|order-cross-feature.adapters" src test` không còn kết quả.
- Analytics chỉ import `src/features/orders/public-api`.
- Build, Analytics/Orders unit test và boundary test pass.

Commit đề xuất: `refactor(orders): simplify analytics access`

Trạng thái ngày 2026-09-22: **đã triển khai trong working tree, chưa commit/push**. Build, scoped
lint, test Orders/Analytics/integration và Orders/Reviews E2E đã pass. Không có `forwardRef`; các
consumer Analytics chỉ import public API chính của Orders.

### Nhịp 2 — Tách logic lớn bên trong Orders

Mục tiêu: làm nhỏ `customer-orders.service.ts` và xóa khái niệm `OrderCoreService` mà không đổi behavior.

Việc làm:

1. Gom tính giá, phí giao hàng, promotion, route fallback, transaction tạo Order, OrderDetail, outbox và rollback vào `OrderCreationService`.
2. Giữ danh sách, lịch sử, đặt lại và chi tiết trong role service phù hợp; không tạo thêm service chỉ để giảm số dòng.
3. Gom chuyển trạng thái, authorization và điều kiện review vào `OrderRulesService`.
4. Tách quy tắc chat/messenger vào `OrderMessagingService`.
5. Giữ role service làm lớp điều phối mỏng:
   - `PublicOrdersService`: calculate/preview công khai.
   - `CustomerOrdersService`: create/list/history/reorder/cancel của customer.
   - `MerchantOrdersService`: danh sách và thao tác của merchant.
   - `AdminOrdersService`: truy vấn/thao tác của admin.
6. Trong nhịp này, `OrderService` tạm delegate sang service mới để route và consumer cũ chưa bị vỡ.

Giới hạn để tránh tách quá tay:

- Mỗi service phải có một trách nhiệm rõ và có caller thật.
- Không tách mỗi hàm thành một file.
- Không đổi DTO, route, response shape, entity hoặc schema.

Exit gate:

- `customer-orders.service.ts` chỉ còn nghiệp vụ theo role; phần tạo Order lớn nằm trong `OrderCreationService`.
- `order-core.service.ts` được xóa.
- Test status, pricing, authorization, create order, history, chat và resolver pass.
- E2E Orders giữ nguyên contract.

Commit đề xuất:

- `refactor(orders): extract order creation service`
- `refactor(orders): consolidate order rules and messaging`

### Nhịp 3 — Sửa ownership Address và Payment

Mục tiêu: bỏ các việc không thuộc Orders ra khỏi service role.

Việc làm:

1. Kiểm tra mọi caller của `createTemporaryAddress`, cleanup cron và `processPayment` cũ.
2. Chuyển cleanup address tạm sang Locations vì Locations sở hữu Address.
3. Orders chỉ gọi Locations public API khi cần địa chỉ trong quá trình tạo order.
4. Nếu `processPayment` cũ không còn route/caller, xóa cùng test xác nhận dead code.
5. Nếu vẫn còn caller, delegate qua Payment public API; Orders không xử lý gateway hoặc thông tin thẻ.
6. Promotion validation/usage tiếp tục đi qua Promotions public API; không import repository Promotion.

Exit gate:

- Orders không có cron cleanup Address.
- Orders không xử lý trực tiếp thông tin thẻ/payment provider.
- Không import repository/entity nội bộ của Locations, Payments hoặc Promotions.
- Order creation rollback vẫn xóa tài nguyên tạm đúng cách.

Commit đề xuất: `refactor(orders): align address and payment ownership`

### Nhịp 4 — Gom boundary với Delivery

Mục tiêu: bỏ các module/public API phụ và tên Reader/Command, nhưng vẫn giữ Orders là nơi duy nhất đổi `Order.status`.

Việc làm:

1. Tạo `OrderDeliveryService` cho các use case Delivery cần: tìm order để dispatch/complete, lấy order của shipper, claim assignment và cập nhật phần trạng thái Order liên quan giao hàng.
2. Đưa authorization/tracking của customer vào cùng `OrderDeliveryService`.
3. Đăng ký/export service trong module và public API chính.
4. Chuyển `DeliveryModule` sang import `OrdersModule` từ public API chính.
5. Chuyển mọi Delivery service/controller sang import service mới từ public API chính.
6. Xóa các module/public API/service Reader và Command cũ sau khi không còn consumer.
7. Giữ event/outbox cho luồng cần durable delivery assignment; không đổi sang gọi đồng bộ nếu làm mất retry.

Rủi ro cần kiểm soát:

- `OrdersModule` rộng hơn các module hẹp cũ, nên phải kiểm tra graph dependency trước khi xóa file.
- Nếu có cycle, không thêm `forwardRef`; phải sửa import ngược hoặc chuyển sang event đúng ownership.
- `OrderDeliveryService` chỉ cung cấp phần Order cho Delivery, không được sở hữu `Delivery.status`.
- Nếu service này bắt đầu thành god service, giữ các hàm nội bộ theo nhóm rõ ràng; chỉ tách thêm file khi có bằng chứng về trách nhiệm độc lập.

Exit gate:

- Delivery chỉ import `src/features/orders/public-api`.
- Không còn Reader/Command trong tên file/class public của Orders.
- Chỉ còn `orders.module.ts` và một `public-api.ts` trong feature Orders.
- Dispatch, assignment, tracking, completion và shipper tests pass.
- Không có `forwardRef` mới.

Commit đề xuất: `refactor(orders): simplify delivery access`

### Nhịp 5 — Bỏ OrderService trung gian và khóa kiến trúc

Mục tiêu: mỗi caller biết rõ service cần dùng; xóa facade chung cũ.

Việc làm:

1. Controller theo role inject role service tương ứng.
2. Chat quick reorder dùng `CustomerOrdersService`.
3. Chat context và Messenger dùng `OrderMessagingService`.
4. Reviews dùng `OrderRulesService`.
5. Analytics dùng `OrderAnalyticsService`.
6. Delivery dùng `OrderDeliveryService`.
7. Public controller dùng `PublicOrdersService`.
8. Chỉ xóa `order.service.ts` sau khi `rg "OrderService" src test` không còn caller thật.
9. Thu gọn `public-api.ts`: chỉ export module, service/type thật sự cần cho feature khác; không export controller, repository hoặc implementation nội bộ.
10. Cập nhật Orders README, dependency graph, audit và boundary tests.

Exit gate:

- Không còn `OrderService` làm facade chung.
- Không còn file/module/API cũ bị bỏ quên.
- Mọi cross-feature import đều đi qua một `orders/public-api.ts`.
- Test kiến trúc bảo vệ cấu trúc mới, không bảo vệ tên cũ.

Commit đề xuất: `refactor(orders): finish role based structure`

## 7. Kế hoạch kiểm thử

Chạy sau mỗi nhịp, không đợi đến cuối:

```powershell
npm run build
npx eslint <các-file-ts-đã-thay-đổi>
npx jest --runInBand --testPathPattern=test/unit/features/orders
npx jest --runInBand --testPathPattern=test/integration
npx jest --config ./test/jest-e2e.json --runInBand
git diff --check
```

| Nhịp | Test bắt buộc |
|---|---|
| Cổng 0 | Orders, Reviews, public contract, ownership, Orders/Reviews E2E |
| Nhịp 1 | Orders analytics, analytics projection/reconciliation, public contract |
| Nhịp 2 | pricing, status, creation, history, access, chat, resolver, Orders E2E |
| Nhịp 3 | order creation rollback, Locations, Payment, Promotions |
| Nhịp 4 | delivery dispatch, assignment, tracking, completion, shipper, Delivery E2E |
| Nhịp 5 | full unit, full integration, full E2E, build và scoped lint |

Nếu Jest trên Windows lỗi cache/worker/permission, chạy `--runInBand` và tách rõ lỗi môi trường với lỗi assertion/compile. Không kết luận pass nếu không có exit code và summary của lần chạy thực tế.

## 8. Điều kiện hoàn thành Orders

- [ ] Một `orders.module.ts` và một `public-api.ts`.
- [ ] Không `forwardRef`.
- [ ] Không deep import giữa các feature.
- [ ] Không feature nào dùng Order repository/entity trực tiếp ngoài Orders.
- [ ] Không còn public class/file tên Reader, Command, Adapter, Core hoặc Facade.
- [ ] Controller và service role dễ tìm.
- [ ] `CustomerOrdersService` không còn là god service.
- [ ] Orders là nơi duy nhất thay đổi `Order.status`.
- [ ] Delivery vẫn sở hữu trip, shipper và `Delivery.status`.
- [ ] Analytics và Reviews chỉ đọc Orders qua service hẹp trong public API chính.
- [ ] EventBus/Outbox vẫn bảo vệ luồng cần transaction/retry.
- [ ] Build, unit, integration và E2E liên quan pass bằng lệnh chạy thực tế.
- [ ] README, dependency graph và boundary tests khớp code hiện tại.
- [ ] Mỗi nhịp có commit riêng; không stage thay đổi không liên quan.

## 9. Thứ tự nên làm ngay

1. Chốt và commit migration Orders–Reviews hiện tại.
2. Làm Nhịp 1 `order-analytics` vì phạm vi nhỏ, tên đích đã rõ và dễ rollback.
3. Làm Nhịp 2 theo hai commit nhỏ.
4. Xử lý Address/Payment ownership.
5. Cuối cùng mới gom Delivery boundary và xóa `OrderService`.

Không nên bắt đầu Nhịp 1 khi phần Orders–Reviews còn lẫn trong working tree. Nếu gom tất cả vào một lần, diff sẽ quá lớn và rất khó xác định lỗi nằm ở pricing, status, Analytics hay Delivery.
