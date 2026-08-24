# delivery

Owner đích: ShippingDetail, PendingShipperAssignment, ShipperCertificateInfo, assignment, tracking và delivery policy. Compatibility implementation: `src/modules/shipper` and queue behavior in `src/infra/queue`.

T2.3 exports `DeliveryQuotePort`; T7.1–T7.6 binds delivery policy and moves it out of the queue adapter. `delivery` remains independent from `orders`.
