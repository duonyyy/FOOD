# delivery

Owner đích: ShippingDetail, PendingShipperAssignment, ShipperCertificateInfo, assignment, tracking và delivery policy. Compatibility implementation: `src/modules/shipper` and queue behavior in `src/infra/queue`.

T7.1 bổ sung `ShipperProfile` và `SHIPPER_PROFILE_READER`. `User` là scalar actor reference trong model Delivery; các field shipper cũ trên User được giữ tạm thời cho compatibility đến khi caller hoàn tất migration.

T2.3 exports `DeliveryQuotePort`; T7.1–T7.6 binds delivery policy and moves it out of the queue adapter. `delivery` remains independent from `orders`.
