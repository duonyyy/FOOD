# restaurants

Owner đích: Restaurant, owner reference, onboarding, approval và restaurant status. T4.1 đã chuyển
onboarding/profile sang feature này; `src/modules/restaurant` đã được gỡ sau khi không còn caller.

`RestaurantReaderPort` đã được bind tại `RestaurantsModule`. Menu, Orders và feature khác phải chỉ
dùng public contract, không dùng Restaurant repository.

Approve/reject là use case riêng `RestaurantApprovalService`: chỉ chuyển từ `pending`, bắt buộc lý
do từ chối, ghi `restaurant_approval_audits` trong cùng transaction và publish audit event sau
commit. Dashboard doanh thu/đơn hàng được hoãn sang T8.3 Analytics để Restaurant không đọc Order
repository.
