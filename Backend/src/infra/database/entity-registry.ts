import { Address } from '../../entities/address.entity';
import { Category } from '../../entities/category.entity';
import { Checkout } from '../../entities/checkout.entity';
import { Conversation } from '../../entities/conversation.entity';
import { DeliveryEarningsEvent } from '../../entities/deliveryEarningsEvent.entity';
import { Food } from '../../entities/food.entity';
import { Message } from '../../entities/message.entity';
import { Notification } from '../../entities/notification.entity';
import { Order } from '../../entities/order.entity';
import { OrderDetail } from '../../entities/orderDetail.entity';
import { OutboxEvent } from '../../entities/outbox-event.entity';
import { PendingShipperAssignment } from '../../entities/pendingShipperAssignment.entity';
import { Permission } from '../../entities/permission.entity';
import { Promotion } from '../../entities/promotion.entity';
import { Restaurant } from '../../entities/restaurant.entity';
import { RestaurantApprovalAudit } from '../../entities/restaurantApprovalAudit.entity';
import { Review } from '../../entities/review.entity';
import { Role } from '../../entities/role.entity';
import { ShipperCertificateInfo } from '../../entities/shipperCertificateInfo.entity';
import { ShipperProfile } from '../../entities/shipperProfile.entity';
import { ShippingDetail } from '../../entities/shippingDetail.entity';
import { SystemConstraint } from '../../entities/systemConstaints.entity';
import { Topping } from '../../entities/topping.entity';
import { User } from '../../entities/user.entity';

export const DATABASE_ENTITIES = [
  Address,
  Category,
  Checkout,
  Conversation,
  DeliveryEarningsEvent,
  Food,
  Message,
  Notification,
  Order,
  OrderDetail,
  OutboxEvent,
  PendingShipperAssignment,
  Permission,
  Promotion,
  Restaurant,
  RestaurantApprovalAudit,
  Review,
  Role,
  ShipperCertificateInfo,
  ShipperProfile,
  ShippingDetail,
  SystemConstraint,
  Topping,
  User,
];

export const DATABASE_ENTITY_NAMES = DATABASE_ENTITIES.map((entity) => entity.name);
