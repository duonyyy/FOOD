# delivery

Owner đích: ShippingDetail, PendingShipperAssignment, ShipperCertificateInfo, assignment, tracking và delivery policy. Compatibility implementation: `src/modules/shipper` and queue behavior in `src/infra/queue`.

T7.1 bổ sung `ShipperProfile` và `SHIPPER_PROFILE_READER`. `User` là scalar actor reference trong model Delivery; các field shipper cũ trên User được giữ tạm thời cho compatibility đến khi caller hoàn tất migration.

T2.3 exports `DeliveryQuotePort`; T7.1–T7.6 binds delivery policy and moves it out of the queue adapter. `delivery` remains independent from `orders`.

T7.2 cung cấp các command `OfferDelivery`, `AcceptDelivery`, `RejectDelivery` và `ReassignDelivery` qua `DeliveryAssignmentCommandService`. API mới nằm dưới `/delivery/assignments`; `AuthGuard` bảo vệ toàn bộ route. `DeliveryAssignmentPolicy` là nơi tập trung rule về order confirmed, shipper đã duyệt, hold 2 phút, timeout, exclusion/retry và quyền actor. `ShipperService` hiện là adapter tương thích cho các caller cũ và sẽ được loại bỏ dần sau khi chuyển hết caller.

T7.3 chuyển scheduler nghiệp vụ sang `DeliveryAssignmentScheduler`. `infra/queue` chỉ còn `QueueService`, `PendingAssignmentStore` và processor; processor parse payload, gọi scheduler, log `queue_job_failed`/`queue_dead_letter` và để BullMQ quyết định retry.

T7.4 bảo vệ accept/reassign bằng transaction và pessimistic lock trên `Order`. Accept kiểm tra lại order cùng `ShippingDetail` trong vùng lock; unique index trên `shippingDetails.order_id` chặn duplicate ở database. Reassign cũng khóa order trước khi đọc trạng thái, nên không publish offer cũ sau khi một shipper đã nhận đơn. Unit test bao phủ accept đồng thời, retry accept và reassign sau khi assignment đã tồn tại; PostgreSQL integration test chạy khi đặt `FOODEE_RUN_POSTGRES_INTEGRATION=1`.

T7.5 giữ Pickup/Accept, Start và Complete là các command riêng. Complete cập nhật delivery trong transaction, tạo outbox event `delivery.completed` với idempotency key theo order, rồi dispatch sau commit. Ordering nhận event qua `DeliveryCompletedOrderHandler` và dùng `completeFromDelivery` có lock/idempotent no-op khi order đã completed; `getOrder` chỉ đọc. Invalid actor/status được kiểm tra ở service tests.
