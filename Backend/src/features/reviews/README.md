# Reviews Feature

Owner: food/shipper review, rating aggregation, moderation và anti-duplicate rule.

Reviews sở hữu repository `Review` và các HTTP APIs liên quan. Module xác thực điều kiện đánh giá thông qua `OrderRulesService` (đơn hàng đã hoàn tất, đúng khách hàng) và `FoodIntegrationService`; module không inject trực tiếp các repository `Order`, `Food`, `Shipper` hay `User`.

`GET /reviews/orders/:orderId/summary` trả trạng thái đánh giá cho actor hiện tại. Reviews lấy context
Order tối thiểu qua `OrderRulesService` trong public API chính của Orders, sau đó tự đọc Review
theo `orderId`; Orders không còn import ngược Reviews.

Cấu trúc phân hệ Reviews được chuẩn hóa theo mô hình Actor-Driven (Role-based) đồng bộ:

```text
src/features/reviews/
├── controllers/                        # 🎯 CONTROLLERS
│   ├── customer-reviews.controller.ts  # 🛍️ Customer (Viết, sửa, xóa, xem review món & shipper)
│   └── food-reviews.controller.ts      # 🍽️ Catalog Public API (/foods/:foodId/reviews)
│
├── services/                           # 📦 SERVICES
│   └── customer-reviews.service.ts     # Review Service, gồm chuyển Review sang ReviewResponseDto
│
├── dto/                                # 📋 DATA TRANSFER OBJECTS
│   ├── create-review.dto.ts
│   └── review-response.dto.ts
│
├── reviews.module.ts                   # Đăng ký controllers & providers
└── public-api.ts                       # Public API boundary cho các feature khác
```
