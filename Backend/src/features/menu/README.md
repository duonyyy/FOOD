# Menu Feature

Quản lý thực đơn món ăn (Food / MenuItem), danh mục (Category), và Topping theo kiến trúc Actor-Driven (Role-based).

## Cấu trúc thư mục

```text
src/features/menu/
├── categories/                         # Quản lý danh mục món ăn (Category)
│   ├── dto/                            # Create, Update, List Query & Response DTOs
│   ├── category.controller.ts          # REST Controller cho Category
│   ├── category.service.ts             # Service CRUD Category + Cache Redis
│   ├── category.mapper.ts              # Chuyển đổi Entity sang Response DTO
│   └── category.module.ts              # NestJS Module cho Category
├── foods/                              # Quản lý món ăn (Food) theo từng Role
│   ├── controllers/
│   │   ├── customer-food.controller.ts # 🛍️ Khách: Tìm kiếm, Geolocation Mapbox, xem menu
│   │   ├── merchant-food.controller.ts # 🏪 Chủ quán: Thêm/Sửa món, đổi trạng thái, quản lý topping
│   │   └── admin-food.controller.ts    # 👑 Quản trị viên: Tra cứu toàn sàn, cưỡng chế xóa món
│   ├── dto/
│   │   ├── create-food.dto.ts
│   │   └── update-food.dto.ts
│   └── services/
│       ├── customer-food.service.ts    # Nghiệp vụ Khách (Search, cự ly, menu, món hot, giảm giá)
│       ├── merchant-food.service.ts    # Nghiệp vụ Chủ quán (CRUD món + Ownership check)
│       ├── admin-food.service.ts       # Nghiệp vụ Admin (Store search, cưỡng chế xóa + dọn dẹp ảnh)
│       ├── food-integration.service.ts # Adapter tích hợp liên module (4 Reader Ports)
│       ├── food-query.service.ts       # Facade tương thích ngược (kế thừa CustomerFoodService)
│       └── food-command.service.ts     # Facade tương thích ngược (kế thừa MerchantFoodService)
├── toppings/                           # Topping đi kèm món ăn
│   ├── dto/                            # Create, Update Topping DTOs
│   ├── topping-command.service.ts      # Quản lý tạo/sửa/xóa topping + kiểm tra quyền sở hữu
│   └── topping.module.ts               # NestJS Module cho Topping
├── contracts/                          # Ports & Interfaces dùng chung
│   ├── catalog-chat-reader.port.ts     # Token CATALOG_CHAT_READER
│   ├── category-reader.port.ts         # Token CATEGORY_READER
│   ├── food-discovery-reader.port.ts   # Token FOOD_DISCOVERY_READER
│   ├── food-review-target-reader.port.ts # Token FOOD_REVIEW_TARGET_READER
│   ├── menu-cache.policy.ts            # Quy tắc Cache TTL & Key naming
│   └── menu-reader.port.ts             # Token MENU_READER (Snapshot cho Ordering)
├── menu.module.ts                      # Đăng ký Controller, Provider và Binding Tokens
└── public-api.ts                       # Public API export ra ngoài module
```

## Public Reader Ports

- `MENU_READER`: Cung cấp snapshot món và topping cho module Ordering khi đặt hàng.
- `FOOD_DISCOVERY_READER`: Cung cấp snapshot món ăn cho Restaurant exploration.
- `CATALOG_CHAT_READER`: Cung cấp snapshot thực đơn cho AI Chatbot.
- `FOOD_REVIEW_TARGET_READER`: Cung cấp thông tin món ăn cho Reviews module.
- `CATEGORY_READER`: Cung cấp snapshot danh mục món ăn.
