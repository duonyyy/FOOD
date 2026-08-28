# delivery

Owner đích: ShippingDetail, PendingShipperAssignment, ShipperCertificateInfo, assignment, tracking và delivery policy. Compatibility implementation: `src/modules/shipper` and queue behavior in `src/infra/queue`.

T7.1 bổ sung `ShipperProfile` và `SHIPPER_PROFILE_READER`. `User` là scalar actor reference trong model Delivery; các field shipper cũ trên User được giữ tạm thời cho compatibility đến khi caller hoàn tất migration.

T2.3 exports `DeliveryQuotePort`; T7.1–T7.6 binds delivery policy and moves it out of the queue adapter. `delivery` remains independent from `orders`.

T7.2 cung cấp các command `OfferDelivery`, `AcceptDelivery`, `RejectDelivery` và `ReassignDelivery` qua `DeliveryAssignmentCommandService`. API mới nằm dưới `/delivery/assignments`; `AuthGuard` bảo vệ toàn bộ route. `DeliveryAssignmentPolicy` là nơi tập trung rule về order confirmed, shipper đã duyệt, hold 2 phút, timeout, exclusion/retry và quyền actor. `ShipperService` hiện là adapter tương thích cho các caller cũ và sẽ được loại bỏ dần sau khi chuyển hết caller.
