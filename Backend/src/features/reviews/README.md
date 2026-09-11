# Reviews Feature

Owner: food/shipper review, rating aggregation, moderation và anti-duplicate rule.

Reviews sở hữu repository `Review` và các HTTP APIs liên quan. Module xác thực tính hợp lệ của việc đánh giá thông qua `Ordering` review eligibility reader (đơn hàng đã hoàn tất, đúng khách hàng) và `Catalog` food target reader; module không inject trực tiếp các repository `Order`, `Food`, `Shipper` hay `User`.

Cấu trúc phân hệ Reviews được chuẩn hóa theo mô hình Actor-Driven (Role-based) đồng bộ:

```text
src/features/reviews/
├── controllers/                        # 🎯 CONTROLLERS
│   ├── customer-reviews.controller.ts  # 🛍️ Customer (Viết, sửa, xóa, xem review món & shipper)
│   └── food-reviews.controller.ts      # 🍽️ Catalog Public API (/foods/:foodId/reviews)
│
├── services/                           # 📦 SERVICES
│   ├── customer-reviews.service.ts     # Core Review Service (Validation, chống trùng, tính rating stats)
│   └── index.ts                        # Barrel export
│
├── mappers/                            # 🗺️ MAPPERS
│   └── review.mapper.ts                # Chuyển đổi Review Entity sang ReviewResponseDto
│
├── dto/                                # 📋 DATA TRANSFER OBJECTS
│   ├── create-review.dto.ts
│   └── review-response.dto.ts
│
├── reviews.module.ts                   # Đăng ký controllers & providers
└── public-api.ts                       # Public API boundary cho các feature khác
```
