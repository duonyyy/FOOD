import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/entities/user.entity';
import { GoogleCloudStorageService } from 'src/gcs/gcs.service';
import { ShippingDetail } from 'src/entities/shippingDetail.entity';
import { Order } from 'src/entities/order.entity';
import { Address } from 'src/entities/address.entity';
import { Promotion } from 'src/entities/promotion.entity';
import { Category } from 'src/entities/category.entity';
import { Checkout } from 'src/entities/checkout.entity';
import { Food } from 'src/entities/food.entity';
import { OrderDetail } from 'src/entities/orderDetail.entity';
import { Restaurant } from 'src/entities/restaurant.entity';
import { Review } from 'src/entities/review.entity';
import { Role } from 'src/entities/role.entity';
import { PendingShipperAssignment } from 'src/entities/pendingShipperAssignment.entity';
import { PendingAssignmentService } from './pending-assignment.service';
/**
 * QueueModule (Module Hàng đợi)
 * Đóng vai trò như một "phân xưởng" chuyên xử lý các tác vụ ngầm (Background Jobs).
 * File này khai báo cho NestJS biết: 
 * - Cần kết nối với những bảng nào trong Database (phần imports)
 * - Có những thợ nào làm việc (phần providers)
 * - Cho phép các Module khác mượn thợ nào ra xài (phần exports)
 */

@Module({
  // 1. IMPORTS: Nạp các entity (Bảng Database) mà phân xưởng này cần dùng
  // (Ví dụ: Cần bảng User, Order, ShippingDetail... để tra cứu thông tin lúc đang chạy job)
  imports: [
    TypeOrmModule.forFeature([
      User, 
      ShippingDetail, 
      Order, 
      Address, 
      Promotion, 
      Food, 
      Restaurant, 
      Category, 
      OrderDetail, 
      Role, 
      Review, 
      Checkout,
      PendingShipperAssignment // Bảng tĩnh lưu trữ trạng thái đơn hàng đang treo chờ gán tài xế
    ]),
  ], 
  // 2. PROVIDERS: Nạp các "Người Thợ" (Services) sẽ làm việc trong phân xưởng này
  providers: [
    QueueService,                   // Người Thợ giao việc: Chuyên tạo ra Job và đẩy vào hàng chờ
    GoogleCloudStorageService,      // Thợ phụ: Hỗ trợ upload file nếu Job yêu cầu
    PendingAssignmentService,       // Người Thợ làm việc (Worker): Túc trực lấy Job từ hàng chờ ra xử lý (gán tài xế)
  ],
  // 3. EXPORTS: Xuất khẩu các Người Thợ
  // Trọng điểm là xuất QueueService ra ngoài, để các API khác (giống như OrderService) 
  // có thể gọi hàm "nhờ tạo dùm tao cái Job".
  exports: [QueueService, PendingAssignmentService],
})
export class QueueModule { }