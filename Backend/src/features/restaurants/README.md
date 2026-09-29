# Restaurants

Restaurants sở hữu `Restaurant` và `RestaurantApprovalAudit` (entity hiện ở `src/entities`). Feature khác dùng `restaurants/public-api.ts` và không inject Restaurant repository. `RestaurantsModule` là module duy nhất của feature. Merchant Orders controller vẫn dùng hợp đồng `findByOwnerId` có từ trước; thay đổi riêng sang snapshot không thuộc lượt refactor cấu trúc này.

## Cấu trúc và vai trò

```text
restaurants/
├── controllers/
│   ├── merchant-restaurants.controller.ts
│   └── admin-restaurants.controller.ts
├── services/
│   ├── public-restaurants.service.ts
│   ├── customer-restaurants.service.ts
│   ├── merchant-restaurants.service.ts
│   └── admin-restaurants.service.ts
├── dto/
├── types/
├── restaurants.module.ts
└── public-api.ts
```

| Provider | Trách nhiệm | Consumer ngoài feature |
| --- | --- | --- |
| `PublicRestaurantsService` | Danh sách và chi tiết nhà hàng approved, kèm khoảng cách | `PublicRestaurantsController` trong Menu |
| `CustomerRestaurantsService` | Snapshot cho tạo đơn, chat và tra cứu vị trí quán khi xem menu | Orders, Messenger, Menu |
| `MerchantRestaurantsService` | Onboarding, hồ sơ, upload, xác minh quyền quản lý quán | Merchant controller, Menu, merchant Orders controller |
| `AdminRestaurantsService` | Yêu cầu pending, signed certificate, approve/reject, audit | Admin controller nội bộ |

`restaurants/public-api.ts` chỉ export `RestaurantsModule`, ba service có consumer ngoài feature, DTO cho public controller ở Menu và snapshot type cần dùng. Admin service không export qua module/API. Mỗi provider chỉ được đăng ký một lần trong `RestaurantsModule`.

Bốn route công khai `/restaurants/all`, `/restaurants/popular`, `/restaurants/preview`, `/restaurants/:id` nằm trong `menu/controllers/public-restaurants.controller.ts`. Controller này ghép snapshot nhà hàng approved với tối đa ba món từ `FoodIntegrationService`; query và quyết định trạng thái nhà hàng vẫn thuộc Restaurants. Cả bốn route cùng nằm trong một controller để `:id` không bắt nhầm `popular` hoặc `preview`.

```text
MenuModule → RestaurantsModule
```

Restaurants không import Menu. `merchant-catalog.module.ts` và `merchant-catalog.public-api.ts` đã được bỏ; Menu chỉ import `restaurants/public-api.ts`. Không dùng `forwardRef()`.

## Hành vi cần giữ

`RestaurantResponseDto.fromRestaurant` là nơi duy nhất tạo response nhà hàng cho ba nhóm controller. Nó giữ `ownerId`, địa chỉ, khoảng cách, thời gian giao hàng, giá trị null và chuyển decimal sang number. `RequestRestaurantDto` không cho merchant tự gửi `ownerId` hoặc `status`.

Merchant controller lấy actor từ JWT, kiểm tra ownership trước cập nhật, xóa và lấy signed URL. Upload giữ giới hạn 5 MB mỗi file, kiểm tra nội dung ảnh trong storage, đường dẫn lưu trữ và cleanup khi lỗi. Admin approval chỉ chuyển từ pending, ghi `Restaurant` và `RestaurantApprovalAudit` trong một transaction; xóa cache và publish audit event sau commit. Cache discovery/profile giữ TTL 60 giây; danh sách món trong `/restaurants/popular` giữ key `restaurant:foods` và TTL 60 giây.

Các điểm chưa đổi nghiệp vụ: ghi Address và Restaurant chưa chung transaction; `/restaurants/popular` hiện lấy ba quán approved đầu tiên chứ chưa có tiêu chí xếp hạng riêng; lookup chat có thể trả pending/rejected với `isActive=false`, còn danh sách đối tác chat chỉ lấy approved. Cần product contract riêng nếu muốn đổi các chính sách đó.
