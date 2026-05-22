# 📚 Hướng Dẫn Chi Tiết Đọc Hiểu Dự Án Fooddie Backend

> **Mục tiêu**: Giúp bạn hiểu cách dự án hoạt động từ tổng quan đến chi tiết

---

## 🎯 1. Tổng Quan Dự Án

**Fooddie** là hệ thống đặt đồ ăn trực tuyến với các tính năng:
- 🍔 Quản lý nhà hàng, món ăn, menu
- 🛒 Đặt hàng, giỏ hàng, thanh toán
- 🚚 Quản lý shipper giao hàng
- 💬 Chat realtime giữa user/restaurant/shipper
- 🔔 Thông báo (notification)
- 🎁 Khuyến mãi (promotion)

---

## 🏗️ 2. Kiến Trúc - Cách Tổ Chức Code

### 2.1. Tech Stack

| Công nghệ | Mục đích |
|-----------|----------|
| **NestJS** | Framework backend (tương tự Express nhưng mạnh hơn) |
| **TypeScript** | Ngôn ngữ lập trình |
| **PostgreSQL** | Database chính |
| **TypeORM** | ORM để tương tác database |
| **GraphQL** | API real-time (subscriptions) |
| **pg-boss** | Job queue xử lý bất đồng bộ |
| **Swagger** | Tài liệu API tự động |

### 2.2. Cấu Trúc Thư Mục `src/`

```
src/
├── main.ts                    # 🚀 ĐIỂM BẮT ĐẦU - Khởi động server
├── app.module.ts              # 📦 Module gốc - đăng ký tất cả modules
│
├── entities/                  # 🗃️ CÁC BẢNG DATABASE (21 bảng)
│   ├── user.entity.ts         #    → Bảng users
│   ├── order.entity.ts        #    → Bảng orders
│   ├── restaurant.entity.ts   #    → Bảng restaurants
│   ├── food.entity.ts         #    → Bảng foods (món ăn)
│   └── ...                    #    → Các bảng khác
│
├── modules/                   # 📁 CÁC NGHIỆP VỤ CHÍNH (15 modules)
│   ├── users/                 #    → Quản lý user
│   ├── order/                 #    → Đặt hàng
│   ├── restaurant/            #    → Nhà hàng
│   ├── food/                  #    → Món ăn
│   ├── payment/               #    → Thanh toán
│   ├── shipper/               #    → Shipper
│   ├── chat/                  #    → Chat
│   ├── notification/          #    → Thông báo
│   └── ...
│
├── auth/                      # 🔐 XÁC THỰC
│   ├── auth.controller.ts     #    → API login/register
│   ├── auth.service.ts        #    → Logic xác thực
│   └── auth.guard.ts          #    → Bảo vệ routes (JWT)
│
├── pg-boss/                   # ⏰ JOB QUEUE (xử lý nền)
│   ├── queue.service.ts       #    → Quản lý hàng đợi
│   └── ...
│
└── migrations/                # 🔄 Database migrations
```

---

## 🔄 3. Pattern Code - Cách Đọc Một Module

> **Mỗi module trong `src/modules/` đều có cấu trúc giống nhau:**

### 3.1. Ví dụ: Module `order/` (Đặt hàng)

```
src/modules/order/
├── order.module.ts       # Khai báo module, import dependencies
├── order.controller.ts   # Định nghĩa API endpoints (routes)
├── order.service.ts      # Logic nghiệp vụ chính
├── order.resolver.ts     # GraphQL resolver (realtime)
└── dto/                  # Data Transfer Objects (validate input)
    ├── create-order.dto.ts
    └── update-order.dto.ts
```

### 3.2. Luồng Xử Lý Request

```
Client gửi request
       ↓
┌─────────────────────────────────────────────────────────┐
│  auth.guard.ts  - Kiểm tra JWT token                    │
└─────────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────────┐
│  order.controller.ts  - Nhận request, gọi service       │
│  @Post('/orders')                                       │
│  createOrder(@Body() data) {                            │
│    return this.orderService.createOrder(data);          │
│  }                                                      │
└─────────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────────┐
│  order.service.ts  - XỬ LÝ LOGIC NGHIỆP VỤ              │
│  - Validate dữ liệu                                     │
│  - Tính tổng tiền                                       │
│  - Lưu vào database                                     │
│  - Gọi payment service                                  │
│  - Đẩy job vào queue                                    │
└─────────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────────┐
│  Repository (TypeORM)  - Tương tác database             │
│  this.orderRepository.save(order)                       │
└─────────────────────────────────────────────────────────┘
       ↓
   PostgreSQL Database
```

---

## 📊 4. Các Entity Chính (Database Models)

### 4.1. Bảng `users` → `user.entity.ts`
```typescript
// Người dùng: customer, restaurant owner, shipper, admin
- id, email, password, phone
- role (customer/owner/shipper/admin)
- addresses[]  → Địa chỉ giao hàng
```

### 4.2. Bảng `orders` → `order.entity.ts`  
```typescript
// Đơn hàng
- id, user_id, restaurant_id
- status: 'pending' | 'confirmed' | 'delivering' | 'completed' | 'canceled'
- total, shippingFee
- paymentMethod, isPaid
- orderDetails[]  → Chi tiết món ăn
- shippingDetail  → Thông tin giao hàng
```

### 4.3. Bảng `restaurants` → `restaurant.entity.ts`
```typescript
// Nhà hàng
- id, name, address, phone
- owner (User)
- foods[]  → Danh sách món ăn
- categories[]
```

### 4.4. Bảng `foods` → `food.entity.ts`
```typescript
// Món ăn
- id, name, price, description, image
- restaurant_id
- category_id
- toppings[]  → Topping đi kèm
- discountPercent  → Giảm giá
```

---

## 🔑 5. Các API Endpoints Quan Trọng

### 5.1. Auth (Xác thực)
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/auth/register` | Đăng ký |
| POST | `/auth/login` | Đăng nhập → nhận JWT token |
| POST | `/auth/refresh` | Làm mới token |

### 5.2. Orders (Đặt hàng)
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/orders` | Tạo đơn hàng mới |
| GET | `/orders` | Lấy tất cả đơn hàng |
| GET | `/orders/my` | Đơn hàng của tôi |
| GET | `/orders/:id` | Chi tiết đơn hàng |
| PUT | `/orders/:id/status` | Cập nhật trạng thái |
| POST | `/orders/calculate` | Tính phí trước khi đặt |

### 5.3. Restaurants
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/restaurants` | Danh sách nhà hàng |
| GET | `/restaurants/:id` | Chi tiết nhà hàng |
| GET | `/restaurants/:id/menu` | Menu nhà hàng |

---

## 💡 6. Tips Đọc Code Hiệu Quả

### ✅ Bước 1: Bắt đầu từ Entry Point
```
Mở file: src/main.ts
→ Xem server khởi động như thế nào
→ CORS, Swagger, ValidationPipe được setup
```

### ✅ Bước 2: Xem Module Gốc
```
Mở file: src/app.module.ts
→ Xem tất cả modules được import
→ Database connection config
→ GraphQL setup
```

### ✅ Bước 3: Chọn 1 Module và Theo Dõi
```
Ví dụ: Theo dõi luồng "Tạo đơn hàng"

1. src/modules/order/order.controller.ts
   → Tìm @Post() createOrder()

2. src/modules/order/order.service.ts  
   → Tìm createOrder() method
   → Đọc logic từng bước

3. src/entities/order.entity.ts
   → Xem cấu trúc bảng order
```

### ✅ Bước 4: Debug bằng Log
```typescript
// Thêm console.log để theo dõi
console.log('Creating order:', data);
console.log('Order details:', orderDetails);
```

---

## 🔗 7. Các Mối Quan Hệ Giữa Entities

```
User (1) ────────< (N) Order
  │                    │
  │                    └───< OrderDetail >─── Food
  │                              └─────────── Topping
  │
  └────────< Address
  
Restaurant (1) ───< (N) Food
    │                    │
    │                    └───< Category
    │
    └────────< Review

Order (1) ────── (1) ShippingDetail ────── Shipper
    │
    └────────< Checkout (payment records)
```

---

## 📁 8. Các File Tài Liệu Khác

| File | Nội dung |
|------|----------|
| `PROJECT_OVERVIEW.md` | Tổng quan kỹ thuật |
| `CODE_FLOW.md` | Luồng xử lý request chi tiết |
| `API_REFERENCE.md` | Tham khảo API endpoints |
| `README.md` | Hướng dẫn setup và chạy |

---

## 🚀 9. Cách Chạy Dự Án

```bash
# 1. Cài dependencies
npm install

# 2. Copy file env
cp .env.example .env

# 3. Chỉnh sửa .env với thông tin database

# 4. Chạy database migrations
npm run migration:run

# 5. Start development server
npm run start:dev

# 6. Mở Swagger docs
# http://localhost:3001/api
```

---

## ❓ 10. Câu Hỏi Thường Gặp

**Q: Làm sao biết API nào cần xác thực?**
> A: Tìm decorator `@UseGuards(AuthGuard)` trong controller

**Q: Làm sao thêm field mới vào database?**
> A: Sửa entity file → Tạo migration → Chạy migration

**Q: GraphQL dùng để làm gì?**
> A: Dùng cho subscriptions (real-time updates) như chat, order status

**Q: pg-boss dùng để làm gì?**
> A: Xử lý các job nặng (gửi email, process payment) bất đồng bộ

---

*📝 Tài liệu này được tạo để giúp bạn nhanh chóng hiểu dự án Fooddie Backend.*
