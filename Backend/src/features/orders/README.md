# orders

Owner: Order, OrderDetail, order state machine, immutable order snapshots và order commands/queries.

Payment, Delivery, Communications and Reviews use contracts/events rather than write Order
repositories.

Orders không import `DeliveryModule`. Khi Order đổi trạng thái, Orders phát
`ORDER_STATUS_CHANGED_EVENT`; Delivery tự quản lý pending assignment. Khi tìm tài xế quá hạn,
Delivery gọi lifecycle command hẹp và Orders tự quyết định có hủy Order hay không.

Status event được lưu bằng Outbox trong cùng transaction với Order. API process dispatch/retry;
queue worker chỉ tạo event và không tự đánh dấu event là `published` khi thiếu consumer.

Delivery định kỳ đọc tối đa 100 ID Order `confirmed` và phục hồi pending assignment
bị thiếu. Reader chỉ trả ID; Delivery tự kiểm tra `ShippingDetail`, assignment hiện có
và trạng thái Order hiện tại trước khi tạo theo cách idempotent.

Messenger dùng `OrderService` cho authorization và danh sách shipper có thể chat. Không còn
`OrderMessagingReaderService`; ownership customer/shipper/status vẫn nằm trong Orders.

Chat dùng cùng `OrderService` qua `orders/public-api.ts` để xem đơn gần đây và tạo đơn sau xác
nhận. Không còn `ChatOrderingService`; Chat không gửi giá tin cậy vào Orders và Orders vẫn tính
lại giá phía server.

Orders không còn đọc Review hoặc gắn `reviewInfo` vào response. Reviews gọi
`OrderReviewRulesService` để lấy review context tối thiểu; frontend gọi review summary riêng.

Analytics dùng `OrderAnalyticsService` qua `orders/public-api.ts`. Service chỉ trả dữ liệu Order
tối thiểu cần cho projection/reconciliation; không còn reader module, adapter hoặc public API riêng.

## Controllers

- `PublicOrdersController`: tính giá và kiểm tra quy tắc khuyến mãi không yêu cầu đăng nhập.
- `CustomerOrdersController`: tạo, xem, xóa và thanh toán đơn hàng.
- `MerchantOrdersController`: xem đơn của nhà hàng và cập nhật trạng thái với quyền chủ quán.
- `AdminOrdersController`: đọc toàn bộ và cập nhật trạng thái bằng permission quản trị.
- `OrderResolver`: subscription GraphQL cho customer và merchant.
- Subscription `orderConfirmedForShippers` thuộc `Delivery/ShipperResolver`; Orders chỉ sở hữu kiểu
  GraphQL và payload contract được xuất qua API hẹp hiện có.

Bốn HTTP controller cùng giữ prefix `/orders`, vì vậy route bên ngoài không thay đổi.
