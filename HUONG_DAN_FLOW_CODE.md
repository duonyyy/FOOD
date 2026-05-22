# Hướng Dẫn Flow Code

Tài liệu này giải thích flow code của backend `fooddie-be-main` theo đúng cấu trúc hiện tại của project, để người mới vào repo có thể:

- biết nên đọc file nào trước
- hiểu request đi qua những lớp nào
- nắm được sự khác nhau giữa REST, GraphQL subscription, cron và queue
- lần ra chỗ cần sửa khi có bug hoặc thêm feature

## 1. Đọc từ đâu trước

Nếu mới vào dự án, nên đọc theo thứ tự này:

1. `src/main.ts`
2. `src/app.module.ts`
3. module đang quan tâm, ví dụ:
   - `src/modules/order`
   - `src/modules/restaurant`
   - `src/modules/food`
4. các service dùng chung trong:
   - `src/services`
   - `src/payment`
   - `src/pg-boss`
5. entity liên quan trong `src/entities`

Lý do:

- `main.ts` cho biết app được boot như thế nào
- `app.module.ts` cho biết toàn bộ module nào đang được nạp
- mỗi module sẽ cho biết route, resolver, service và provider liên quan
- entity giúp hiểu dữ liệu cuối cùng được lưu ra DB ra sao

## 2. Entry point của ứng dụng

App bắt đầu ở `src/main.ts`.

Những việc chính đang diễn ra ở đây:

- tạo Nest application bằng `NestFactory.create(AppModule, new ExpressAdapter(), ...)`
- cấu hình CORS
- bật `ValidationPipe` global
- bật Swagger khi không phải production
- lắng nghe ở `process.env.PORT || 3001`

Flow khởi động:

```text
Node process
  -> src/main.ts
  -> NestFactory.create(AppModule)
  -> nạp AppModule
  -> nạp các module con
  -> đăng ký controller / provider / resolver / cron
  -> mở HTTP server
```

## 3. AppModule đóng vai trò gì

`src/app.module.ts` là nơi ghép toàn bộ hệ thống.

Tại đây app:

- cấu hình `ConfigModule`
- cấu hình `TypeOrmModule.forRootAsync(...)`
- nạp các module nghiệp vụ như:
  - `AuthModule`
  - `UsersModule`
  - `RestaurantModule`
  - `FoodModule`
  - `OrderModule`
  - `ChatModule`
  - `MessengerModule`
  - `NotificationModule`
- bật `ScheduleModule.forRoot()`
- bật `GraphQLModule.forRoot(...)`
- nạp `PgBossModule` và `QueueModule`

Điểm quan trọng:

- project này không chỉ có REST API
- nó còn có GraphQL subscription cho realtime
- có cron job chạy nền
- có pg-boss để xử lý hàng đợi

## 4. Flow chuẩn của một request REST

Hầu hết API REST trong project đi theo flow này:

```text
Client
  -> Controller
  -> Service
  -> Repository / TypeORM
  -> PostgreSQL
  -> Service
  -> Controller
  -> Client
```

Diễn giải:

### Controller

Controller nhận request HTTP, lấy params, body, query và gọi sang service.

Ví dụ:

- `src/modules/order/order.controller.ts`
- `src/modules/restaurant/restaurant.controller.ts`
- `src/modules/food/food.controller.ts`

Controller trong repo này thường:

- map body sang DTO hoặc object nội bộ
- gọi service
- đôi khi phối hợp thêm payment, pubsub hoặc pending assignment

### Service

Service là nơi chứa business logic chính.

Ví dụ:

- `OrderService` xử lý tạo đơn, tính phí, validate khoảng cách, promotion, cập nhật trạng thái
- `RestaurantService` xử lý tạo/cập nhật nhà hàng, geocode địa chỉ, upload ảnh
- `FoodService` xử lý tìm món, lọc theo category, khoảng cách, topping

### Repository / Entity

Service dùng `@InjectRepository(...)` để truy cập entity qua TypeORM.

Ví dụ:

- `Order`
- `Restaurant`
- `Address`
- `User`
- `Promotion`
- `SystemConstraint`

## 5. Flow tạo đơn hàng

Đây là flow quan trọng nhất trong codebase hiện tại.

File chính:

- `src/modules/order/order.controller.ts`
- `src/modules/order/order.service.ts`
- `src/services/mapbox.service.ts`
- `src/services/system-constraints.service.ts`
- `src/payment/payment.service.ts`

Flow rút gọn:

```text
Client gọi POST /orders
  -> OrderController.createOrder()
  -> nếu client gửi custom address và chưa có addressId:
       OrderService.createTemporaryAddress()
  -> OrderService.createOrder()
  -> lấy user, restaurant, address
  -> kiểm tra tọa độ
  -> MapboxService.calculateBikeRoute()
  -> SystemConstraintsService.getConstraints()
  -> SystemConstraintsService.isDistanceWithinLimits()
  -> tính shipping fee / total / promotion
  -> tạo Order + OrderDetail trong transaction
  -> nếu paymentMethod != cod:
       PaymentService.createCheckout()
     nếu paymentMethod == cod:
       publish event orderCreated
  -> trả response cho client
```

Các điểm cần nhớ:

- đơn hàng dùng transaction khá nhiều
- quãng đường không còn chỉ tính bằng haversine, mà ưu tiên Mapbox Directions
- nếu là địa chỉ tạm, hệ thống tạo `Address` tạm cho order
- COD và online payment tách flow ở controller sau khi order đã tạo

## 6. Flow cập nhật trạng thái đơn hàng

Khi nhà hàng đổi trạng thái đơn:

```text
Client gọi PUT /orders/:id/status
  -> AuthGuard
  -> OrderController.updateOrderStatus()
  -> kiểm tra user hiện tại có phải owner nhà hàng không
  -> OrderService.updateOrderStatus()
  -> publish orderStatusUpdated qua pubSub
  -> nếu status chuyển thành confirmed:
       PendingAssignmentService.addPendingAssignment()
  -> nếu status rời khỏi confirmed:
       PendingAssignmentService.removePendingAssignment()
  -> trả order mới
```

Ý nghĩa:

- REST dùng để thay đổi trạng thái
- GraphQL subscription được dùng để đẩy realtime cho user và shipper
- `pending assignment` là cầu nối giữa đơn đã xác nhận và logic gán shipper

## 7. Flow nhà hàng và geocoding

File chính:

- `src/modules/restaurant/restaurant.service.ts`
- `src/services/geocoding.service.ts`
- `src/gcs/gcs.service.ts`

Flow:

```text
Client tạo hoặc cập nhật restaurant
  -> RestaurantService
  -> kiểm tra owner
  -> tạo hoặc cập nhật Address
  -> nếu frontend chưa gửi lat/lng:
       GeocodingService.geocode()
       -> Mapbox Geocoding API
  -> upload avatar / background / certificate lên GCS nếu có
  -> lưu Restaurant
  -> trả dữ liệu về client
```

Điểm cần nhớ:

- geocode không phải bước bắt buộc tuyệt đối
- nếu geocode lỗi, nhiều chỗ vẫn tiếp tục lưu được nhưng sẽ thiếu tọa độ
- thiếu tọa độ sẽ ảnh hưởng flow tính khoảng cách và giao hàng về sau

## 8. Flow tìm món ăn theo vị trí

File chính:

- `src/modules/food/food.service.ts`
- `src/services/mapbox.service.ts`

Flow:

```text
Client tìm món theo tên / vị trí
  -> FoodService.findByName(...)
  -> query food + restaurant
  -> xử lý theo batch
  -> gọi getDistanceAndDurationFromMapbox(...)
  -> gắn distance / deliveryTime vào từng restaurant
  -> lọc theo radius
  -> sort theo khoảng cách
  -> trả kết quả
```

Điểm đáng chú ý:

- `FoodService` hiện dùng hàm export tự do từ `mapbox.service.ts`
- trong khi `OrderService` inject class `MapboxService`
- tức là repo hiện đang có 2 cách dùng Mapbox song song

## 9. Flow GraphQL subscription

GraphQL được cấu hình trong `AppModule`, chủ yếu phục vụ realtime.

File chính:

- `src/modules/order/order.resolver.ts`
- `src/pubsub.ts`

Các subscription quan trọng:

- `orderCreated`
- `orderStatusUpdated`
- `orderConfirmedForShippers`

Flow realtime cho user:

```text
Backend đổi trạng thái order
  -> pubSub.publish('orderStatusUpdated', payload)
  -> OrderResolver.orderStatusUpdated subscription
  -> filter theo userId
  -> client nhận realtime event
```

Flow realtime cho shipper:

```text
Shipper subscribe GraphQL
  -> OrderResolver.orderConfirmedForShippers(...)
  -> ActiveShipperTracker.addShipper(...)
  -> SystemConstraintsService.isShipperEligible(...)
  -> shipper vào active pool

Khi order được confirmed
  -> hệ thống chọn shipper phù hợp
  -> pubSub.publish('orderConfirmedForShippers', ...)
  -> chỉ shipper mục tiêu nhận event
```

## 10. Flow shipper assignment

Phần này nằm khá nhiều trong `src/modules/order/order.resolver.ts`.

`ActiveShipperTracker` đang giữ:

- danh sách shipper online
- queue shipper cho từng order
- score ưu tiên
- cleanup định kỳ

Flow logic:

```text
Shipper online / subscribe
  -> addShipper()
  -> kiểm tra eligibility
  -> lưu vào active pool

Order confirmed
  -> tạo queue shipper phù hợp
  -> xếp theo score và khoảng cách
  -> publish cho shipper mục tiêu

Shipper offline lâu
  -> cleanup()
  -> xóa khỏi active pool và queue
```

Điểm quan trọng:

- đây là logic realtime trong memory khá nhiều
- không phải toàn bộ state đều nằm ở database
- khi debug shipper assignment, cần đọc cả resolver chứ không chỉ service

## 11. Flow cron jobs

Project có dùng `@nestjs/schedule`.

Một số cron đang nằm trong `OrderService`:

- auto cancel order bị kẹt ở `processing_payment`
- auto cancel order confirmed nhưng lâu không có shipper
- cleanup địa chỉ tạm cũ

Flow chung:

```text
Nest scheduler tick
  -> gọi method có @Cron(...)
  -> query DB lấy record cần xử lý
  -> cập nhật trạng thái
  -> publish event hoặc log nếu cần
```

Cron quan trọng vì:

- nhiều trạng thái đơn không chỉ đổi bởi user action
- có những thay đổi diễn ra tự động theo thời gian

## 12. Flow queue với pg-boss

File chính:

- `src/pg-boss/pg-boss.module.ts`
- `src/pg-boss/queue.module.ts`
- `src/pg-boss/queue.service.ts`
- `src/pg-boss/pending-assignment.service.ts`

`QueueService` là wrapper quanh `pg-boss`.

Nó hỗ trợ:

- add job
- xem queue size
- lấy pending jobs
- cancel job
- complete job
- fail job
- archive / purge

Flow tổng quát:

```text
Service nào đó cần xử lý nền
  -> QueueService.addJob(...)
  -> pg-boss lưu job vào PostgreSQL
  -> worker hoặc consumer lấy job ra xử lý
  -> cập nhật trạng thái job
```

Lưu ý:

- trong repo hiện tại, phần queue có mặt rõ trong cấu trúc
- nhưng không phải mọi flow nghiệp vụ đều đang chuyển hoàn toàn sang queue
- cần đọc chỗ gọi cụ thể để biết flow đó là sync hay async

## 13. Flow authentication và guard

File chính:

- `src/auth/auth.module.ts`
- `src/auth/auth.controller.ts`
- `src/auth/auth.service.ts`
- `src/auth/auth.guard.ts`
- `src/auth/websocket-auth.guard.ts`

Flow REST có auth:

```text
Client gửi request kèm Authorization
  -> AuthGuard
  -> verify token / user
  -> attach user vào req.user
  -> controller lấy req.user để xử lý tiếp
```

Flow WebSocket / GraphQL:

- `GraphQLModule` lấy `connectionParams.authorization`
- guard hoặc context tiếp theo dùng token đó để xác thực

## 14. Khi debug nên lần theo thứ tự nào

### Nếu lỗi API REST

Đi theo thứ tự:

1. controller
2. service
3. service dùng chung
4. repository/entity
5. migration nếu nghi ngờ schema

### Nếu lỗi realtime

Đi theo thứ tự:

1. nơi `pubSub.publish(...)`
2. resolver subscription
3. filter của subscription
4. auth/context websocket

### Nếu lỗi tự động theo thời gian

Đi theo thứ tự:

1. method có `@Cron(...)`
2. query DB bên trong
3. log trạng thái trước và sau update

### Nếu lỗi shipper assignment

Đi theo thứ tự:

1. `OrderController.updateOrderStatus(...)`
2. `PendingAssignmentService`
3. `OrderResolver`
4. `ActiveShipperTracker`
5. `SystemConstraintsService`

## 15. Sơ đồ tổng hợp

```text
HTTP / GraphQL Client
  -> main.ts
  -> AppModule
  -> Module tương ứng
  -> Controller hoặc Resolver
  -> Service
  -> Shared Service / Payment / Queue / PubSub
  -> Repository / TypeORM
  -> PostgreSQL

Ngoài ra còn có:
  -> Cron jobs chạy nền
  -> GraphQL subscriptions cho realtime
  -> pg-boss cho hàng đợi
```

## 16. Tóm tắt ngắn

- `main.ts` khởi động app
- `app.module.ts` ghép toàn bộ module
- request REST thường đi theo `Controller -> Service -> Repository`
- realtime đi qua `pubSub -> GraphQL Resolver`
- logic giao hàng dùng nhiều ở `OrderService`, `MapboxService`, `SystemConstraintsService`
- logic shipper online và assignment đang nằm đáng kể trong `OrderResolver`
- nhiều trạng thái được đổi tự động bằng cron chứ không chỉ từ request người dùng

## 17. File nên đọc tiếp theo

Sau tài liệu này, nếu muốn hiểu sâu hơn, nên đọc tiếp:

- `src/services/README.md`
- `src/modules/order/order.service.ts`
- `src/modules/order/order.controller.ts`
- `src/modules/order/order.resolver.ts`
- `src/modules/restaurant/restaurant.service.ts`
- `src/modules/food/food.service.ts`
- `src/services/system-constraints.service.ts`
- `src/services/mapbox.service.ts`
