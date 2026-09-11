# Delivery Feature

Owner: ShippingDetail, PendingShipperAssignment, ShipperCertificateInfo, ShipperProfile, DeliveryEarningsEvent.

Cấu trúc phân hệ Giao vận được chuẩn hóa theo mô hình Actor-Driven (Role-based) đồng bộ với toàn hệ thống:

```text
src/features/delivery/
├── controllers/                        # 🎯 3 CONTROLLER ĐÚNG 3 ROLE (+ 1 GraphQL Resolver)
│   ├── shipper-delivery.controller.ts  # 🛵 Shipper (Nhận/từ chối cuốc, cập nhật GPS, xem lịch sử, dashboard)
│   ├── customer-delivery.controller.ts # 🛍️ Customer (Theo dõi vị trí shipper trên bản đồ)
│   ├── admin-delivery.controller.ts    # 👑 Admin (Duyệt hồ sơ bằng lái, khóa tài xế)
│   └── shipper.resolver.ts             # 📡 GraphQL Subscriptions (orderConfirmedForShippers, tracking)
│
├── services/                           # 📦 CHIA THÀNH 4 THƯ MỤC CON CHUYÊN BIỆT
│   ├── shipper/                        # 🛵 Nghiệp vụ Shipper (Cuốc xe, Hồ sơ, GPS, Thu nhập)
│   │   ├── shipper-delivery.service.ts
│   │   ├── shipper-profile.service.ts
│   │   ├── delivery-earnings.service.ts
│   │   ├── delivery-report.service.ts
│   │   ├── shipper.service.ts
│   │   └── delivery-earnings-projection.service.ts
│   ├── dispatch/                       # ⚡ Hệ thống Điều phối & Ghép cuốc
│   │   ├── delivery-dispatch.service.ts
│   │   ├── delivery-assignment-scheduler.service.ts
│   │   └── delivery-assignment-command.service.ts
│   ├── admin/                          # 👑 Nghiệp vụ Admin duyệt tài xế
│   │   └── admin-delivery.service.ts
│   ├── integration/                    # 🔌 Cổng tích hợp (Reader & Quote Ports)
│   │   └── delivery-integration.service.ts
│   └── index.ts                        # 📦 Barrel export toàn bộ
│
├── contracts/                          # Ports, Commands (Offer, Accept, Reject, Reassign), Policies
├── dto/                                # Data Transfer Objects
├── delivery.module.ts                  # NestJS Module đăng ký providers & exports
└── public-api.ts                       # Public API boundary cho các feature khác
```

## Các điểm nhấn kiến trúc

1. **Chuẩn hóa Role-based Controllers**:
   - `ShipperDeliveryController`: Đảm nhiệm mọi hành vi của tài xế (`/shippers/*` và `/delivery/assignments/*`).
   - `CustomerDeliveryController`: Khách hàng theo dõi vị trí giao vận (`/customer/delivery/*`).
   - `AdminDeliveryController`: Ban quản trị kiểm duyệt tài xế (`/admin/delivery/*`).
2. **Thuật ngữ chuẩn ngành giao vận (Dispatch thay vì Assignment)**:
   - Thay thế thuật ngữ máy móc `assignment` thành `dispatch` (Điều phối cuốc xe) qua `DeliveryDispatchService`.
   - `DeliveryDispatchPolicy` quản lý các quy tắc giữ cuốc 2 phút (Hold TTL), timeout và retry.
3. **Quản lý thu nhập tập trung**:
   - `DeliveryEarningsService` hợp nhất việc tính toán thu nhập (`DeliveryEarningsEvent` immutable ledger) và tự động bắt sự kiện `delivery.completed` để cập nhật `ShipperProfile`.
