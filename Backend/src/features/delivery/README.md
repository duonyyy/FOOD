# Delivery

Delivery sở hữu `ShippingDetail`, `PendingShipperAssignment`, `ShipperProfile`, `ShipperCertificateInfo` và `DeliveryEarningsEvent`. Orders là nơi duy nhất đổi `Order.status`; Delivery yêu cầu thao tác Orders qua `orders/public-api.ts` và các event/Outbox hiện có.

## Tìm code ở đâu

| Việc cần làm | Điểm bắt đầu | Ghi chú |
| --- | --- | --- |
| Báo giá, tracking, quyền xem vị trí | `services/customer-delivery.service.ts` | Kiểm tra quyền sở hữu Order trước khi đọc tracking; controller bỏ số điện thoại shipper khỏi response. |
| Offer/accept/reject/reassign, tìm shipper, retry, cleanup | `services/delivery-dispatch.service.ts` | Dùng Redis pending-assignment store và queue `find-shipper`; không đổi `Order.status` trực tiếp. |
| Shipper đang hoạt động và xếp hạng | `services/dispatch/active-shipper-tracker.service.ts` | Giữ riêng vì có bộ nhớ/timer và điều kiện khả dụng; không ghép vào dispatch chỉ để bớt file. |
| Giữ chỗ, hoàn tất chuyến và ghi thu nhập | `services/delivery-trip.service.ts` | Ba luồng vẫn có transaction riêng; Outbox và `idempotencyKey` giữ nguyên. Orders quyết định trạng thái Order. |
| Lịch sử, dashboard, báo cáo | `services/delivery-report.service.ts` | Đọc `ShippingDetail`/`ShipperProfile`; một báo cáo hiện join sang bảng Order (xem giới hạn bên dưới). |
| Hồ sơ và GPS shipper | `services/shipper/shipper-profile.service.ts` | Provider thuộc `ShipperProfileModule` hẹp vì Auth đang cần nó. |
| API shipper và kiểm tra quyền chuyến | `services/shipper-delivery.service.ts` | Giữ một số entry point cho route shipper; các method chuyển tiếp không có caller đã được bỏ. |
| Event Orders/Delivery | `handlers/delivery-events.handler.ts` | Một nơi đăng ký/hủy bốn subscriber; saga và earnings không tự subscribe. |

HTTP controller theo vai trò ở `controllers/`: customer, shipper, admin và controller tương thích `/users/shippers/**`; GraphQL subscription ở `controllers/shipper.resolver.ts`. `queue/find-shipper.processor.ts` là worker, `adapters/redis-pending-assignment-store.service.ts` là adapter; chúng không phải role service.

`FindShipperProcessor` chỉ được provide một lần: `DeliveryModule` có thể provide nếu cờ đã bật lúc module được nạp; `WorkerModule` kiểm tra danh sách provider thực tế của Delivery và chỉ provide khi còn thiếu. Cách này vẫn đúng nếu `.env` được nạp muộn. Worker dùng queue `find-shipper` và `DeliveryDispatchService` của module sở hữu.

## Ranh giới module

Hiện có `delivery.module.ts`/`public-api.ts` và `shipper-profile.module.ts`/`shipper-profile.public-api.ts`. Đây là ngoại lệ có chủ đích: `AuthModule` import module hồ sơ hẹp, còn `DeliveryModule` cần Auth trực tiếp và gián tiếp qua Identity/Orders. Không thay bằng `AuthModule → DeliveryModule` khi các chiều kia còn tồn tại; không dùng `forwardRef()` để che vòng. Module hồ sơ chỉ export `ShipperProfileService`; module chính export `CustomerDeliveryService` và `DeliveryDispatchService` vì worker cần dispatch qua DI.

Đăng ký shipper mới đi qua `ShipperProfileService.registerPending()`: một transaction dùng cùng manager cho lệnh tạo User ở Users và lệnh tạo ShipperProfile ở Delivery. Auth chỉ gọi API hẹp của Delivery; không trực tiếp lưu entity. Nếu ghi profile lỗi, transaction ném lỗi để rollback account mới.

Entity vẫn ở `src/entities` theo quyết định chung của dự án. Không deep-import vào feature khác. Sáu service chính trong [kế hoạch](../../../DELIVERY_REFACTORING_PLAN.md) hiện nằm trực tiếp trong `services/`. Hai service hỗ trợ vẫn riêng: `ShipperProfileService` thuộc module hồ sơ hẹp mà Auth cần; `ActiveShipperTrackerService` quản lý bộ nhớ/timer và điều kiện khả dụng. Tổng cộng tám file service nghiệp vụ, không tính adapter Redis. Không xóa transaction, Outbox hoặc khóa chống trùng để giảm số file.

## Giới hạn đã biết

- `DeliveryReportService.getIncomeReport()` join qua quan hệ `ShippingDetail.order` để đọc `shipperEarnings`, `shippingFee` và `deliveryDistance` từ Order. Đây là phụ thuộc dữ liệu còn cần thiết kế snapshot/API hẹp; không tự đổi báo cáo khi chưa kiểm tra số liệu và hiệu năng.
- `ShipperDeliveryService.cancelOrder()` gọi Orders hủy trước khi lưu trạng thái chuyến và thống kê shipper bằng các lần save riêng. Nếu bước sau lỗi có nguy cơ lệch trạng thái; cần thiết kế transaction/compensation riêng.
- Rollback đăng ký shipper đã có code và unit test, nhưng test PostgreSQL thật chưa chạy ở môi trường mặc định. Account mồ côi từ trước thay đổi này vẫn có thể tồn tại; không tự xóa hoặc ghi đè chúng.
- Test concurrency PostgreSQL cần `FOODEE_RUN_POSTGRES_INTEGRATION=1` và database thật. Skip trong môi trường mặc định không được tính là pass.

## Kiểm tra

Chạy `npm run build`, lint/boundary và các test Delivery/Auth liên quan khi đổi code. Các test quan trọng nằm trong `test/unit/features/delivery`, `test/unit/features/auth/shipper-auth-flow.spec.ts`, `test/integration/features/delivery`, `test/integration/feature-ownership-boundaries.spec.ts` và `test/e2e/delivery-tracking-policy.e2e-spec.ts`. Kết quả từng lần chạy được ghi trong `DELIVERY_REFACTORING_PLAN.md`; không suy ra trạng thái pass từ tên test.

Nhịp 4 (2026-09-24): build, 111 unit suite/391 test, 26 integration suite/76 test và 10 E2E suite/32 test đạt; 2 integration suite/3 test PostgreSQL skip. Full lint còn lỗi CRLF/Prettier và 6 lỗi test ngoài Delivery. Đây không phải xác nhận production-ready hay dữ liệu/giao dịch với dịch vụ thật.

Sau nhịp 4, đã gom assignment, completion và earnings projection vào `DeliveryTripService`, đồng thời đưa sáu service chính lên một tầng thư mục. Những kết quả test nhịp 4 ở trên là kết quả trước lần gom này; xem kế hoạch để biết gate chạy sau lần gom.
