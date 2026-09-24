# Menu

Menu sở hữu Food, Category và Topping. Entity vẫn ở `src/entities`; `MenuModule` là module NestJS duy nhất của feature.

```text
src/features/menu/
├── menu.module.ts
├── public-api.ts
├── README.md
├── categories/
│   ├── category.controller.ts
│   ├── category.service.ts
│   └── dto/
│       ├── create-category.dto.ts
│       ├── update-category.dto.ts
│       ├── list-category-query.dto.ts
│       └── category-response.dto.ts
├── foods/
│   ├── controllers/
│   │   ├── customer-food.controller.ts
│   │   ├── merchant-food.controller.ts
│   │   └── admin-food.controller.ts
│   ├── services/
│   │   ├── food-customer.service.ts
│   │   ├── food-merchant.service.ts
│   │   ├── food-admin.service.ts
│   │   ├── food-topping.service.ts
│   │   └── food-integration.service.ts
│   └── dto/
│       ├── create-food.dto.ts
│       ├── update-food.dto.ts
│       └── toppings/
│           ├── create-topping.dto.ts
│           └── update-topping.dto.ts
├── contracts/
│   └── menu-cache.policy.ts
└── types/
    ├── catalog-chat.types.ts
    ├── category.types.ts
    ├── food-discovery.types.ts
    └── menu.types.ts
```

`MenuModule` đăng ký CategoryService, FoodCustomerService, FoodMerchantService, FoodAdminService, FoodToppingService và FoodIntegrationService mỗi provider một lần. Nó import `AuthModule`, TypeORM repositories của Food/Category/Topping và `MerchantCatalogModule` qua `restaurants/merchant-catalog.public-api.ts` để kiểm tra quyền quản lý quán mà không tạo vòng với RestaurantsModule.

`CategoryService` tự tạo response DTO, gồm `foodCount`, danh sách món và giá trị null. `FoodToppingService` kiểm tra quyền sở hữu, tên/giá topping và xóa cache sau thao tác ghi. `FoodIntegrationService` cung cấp snapshot cho Orders, Restaurants, Reviews và Chat qua `menu/public-api.ts`; availability của đơn hàng vẫn xét trạng thái món, nhà hàng và topping.

`FoodQueryService` và `FoodCommandService` cũ không có consumer runtime. `getMenuForUser` nằm ở FoodCustomerService; snapshot `listRestaurantFoods`, `listAvailableFoods`, `findAvailableFood`, `getOrderableItems` nằm ở FoodIntegrationService; tra cứu admin và xóa món của admin nằm ở FoodAdminService. Test tương ứng gọi trực tiếp service sở hữu hành vi.
