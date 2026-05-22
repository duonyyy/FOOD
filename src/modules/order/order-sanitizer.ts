import { Injectable } from '@nestjs/common';
import { Order } from 'src/entities/order.entity';

@Injectable()
export class OrderSanitizer {
  cleanSensitiveData(order: Order): void {
    if (order.user) {
      delete (order.user as any).password;
      delete (order.user as any).resetPasswordToken;
      delete (order.user as any).resetPasswordExpires;
      delete (order.user as any).birthday;
      delete (order.user as any).lastLoginAt;
      delete (order.user as any).createdAt;
      delete (order.user as any).googleId;

      if (order.user.role) {
        delete (order.user.role as any).isSystem;
        delete (order.user.role as any).description;
        delete (order.user.role as any).createdAt;
        delete (order.user.role as any).updatedAt;
      }

      if (order.user.address) {
        order.user.address.forEach((addr) => {
          delete (addr as any).latitude;
          delete (addr as any).longitude;
        });
      }
    }

    if (order.restaurant) {
      delete (order.restaurant as any).openTime;
      delete (order.restaurant as any).closeTime;
      delete (order.restaurant as any).licenseCode;
      delete (order.restaurant as any).certificateImage;
      delete (order.restaurant as any).updatedAt;
      delete (order.restaurant as any).createdAt;
    }

    if (order.orderDetails) {
      order.orderDetails.forEach((detail) => {
        if (detail.food) {
          delete (detail.food as any).soldCount;
          delete (detail.food as any).purchasedNumber;
        }
      });
    }

    if (order.shippingDetail?.shipper) {
      const shipper = order.shippingDetail.shipper;
      delete (shipper as any).password;
      delete (shipper as any).resetPasswordToken;
      delete (shipper as any).resetPasswordExpires;
      delete (shipper as any).email;
      delete (shipper as any).birthday;
      delete (shipper as any).lastLoginAt;
      delete (shipper as any).createdAt;
      delete (shipper as any).googleId;
      delete (shipper as any).address;
      delete (shipper as any).role;
    }

    if (order.promotionCode) {
      delete (order.promotionCode as any).usageLimit;
      delete (order.promotionCode as any).usageCount;
      delete (order.promotionCode as any).createdAt;
      delete (order.promotionCode as any).updatedAt;
    }
  }
}
