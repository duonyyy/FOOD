import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ShipperProfile } from 'src/entities/shipperProfile.entity';
import { ShippingDetail, ShippingStatus } from 'src/entities/shippingDetail.entity';
import { OrderDeliveryService } from 'src/features/orders/public-api';
import { Repository } from 'typeorm';
import { SHIPPER_PROFILE_STATUS } from '../types/shipper-profile.types';
import { DeliveryDispatchService } from './delivery-dispatch.service';
import { DeliveryTripService } from './delivery-trip.service';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Shipper-facing trip operations and legacy route entry points.
 */
@Injectable()
export class ShipperDeliveryService {
  protected readonly logger = new Logger(ShipperDeliveryService.name);

  constructor(
    @InjectRepository(ShippingDetail)
    protected shippingDetailRepository: Repository<ShippingDetail>,
    @InjectRepository(ShipperProfile)
    protected shipperProfileRepository: Repository<ShipperProfile>,
    protected pendingAssignmentService: DeliveryDispatchService,
    protected readonly deliveryTripService: DeliveryTripService,
    protected readonly orderDelivery: OrderDeliveryService,
  ) {}

  /**
   * Assign an order to a shipper
   */
  async assignOrderToShipper(
    orderId: string,
    shipperId: string,
    responseTimeSeconds: number = 120,
  ) {
    return this.pendingAssignmentService.assignOrderToShipper(
      orderId,
      shipperId,
      responseTimeSeconds,
    );
  }

  async getOrder(orderId: string, shipperId: string) {
    const shippingDetail = await this.shippingDetailRepository.findOne({
      where: {
        order: { id: orderId },
        shipper: { id: shipperId },
      },
    });

    this.logger.log(`Fetching order ${orderId} for shipper ${shipperId}`);

    if (!shippingDetail) {
      throw new NotFoundException('Shipping detail not found for this order and shipper');
    }

    this.logger.log(`Order ${orderId} found for shipper ${shipperId}`);

    this.logger.log(`Order ${orderId} successfully retrieved for shipper ${shipperId}`);
    return this.orderDelivery.getShipperOrder(orderId);
  }

  async startOrder(orderId: string, shipperId: string) {
    const shippingDetail = await this.shippingDetailRepository.findOne({
      where: { order: { id: orderId }, shipper: { id: shipperId } },
    });
    if (!shippingDetail) {
      throw new NotFoundException('Shipping detail not found for this order and shipper');
    }
    return this.orderDelivery.startDelivery(orderId);
  }

  async getPendingAssignmentForShipper(shipperId: string) {
    return this.pendingAssignmentService.getPendingAssignmentForShipper(shipperId);
  }

  async markOrderCompleted(orderId: string, shipperId: string) {
    return this.deliveryTripService.complete(orderId, shipperId);
  }

  async getCompletedOrdersByShipper(shipperId: string) {
    const completedDetails = await this.shippingDetailRepository.find({
      where: {
        shipper: { id: shipperId },
        status: ShippingStatus.COMPLETED,
      },
      loadRelationIds: { relations: ['order'] },
      order: { actualDeliveryTime: 'DESC' },
    });

    const orderIds = completedDetails
      .map((detail) => (detail as unknown as { order: string | { id: string } }).order)
      .map((order) => (typeof order === 'string' ? order : order?.id))
      .filter((orderId): orderId is string => Boolean(orderId));
    const orders = await this.orderDelivery.getShipperOrders(orderIds);

    return completedDetails.flatMap((detail) => {
      const relation = (detail as unknown as { order: string | { id: string } }).order;
      const order = orders.get(typeof relation === 'string' ? relation : relation?.id);
      if (!order) return [];
      return {
        id: order.id,
        code: `ĐH${order.id.slice(0, 4).toUpperCase()}`,
        status: detail.status,
        shipFee: 10000,
        total: order.total,
        user: {
          name: order.user?.name || 'Không rõ',
        },
        restaurant: {
          name: order.restaurant?.name || '',
        },
        address: {
          street: order.address?.street || '',
        },
        deliveryTo: [
          order.address?.street,
          order.address?.ward,
          order.address?.district,
          order.address?.city,
        ]
          .filter(Boolean)
          .join(', '),
        orderDetails: order.orderDetails.map((d) => ({
          food: {
            name: d.food?.name ?? '',
          },
          quantity: d.quantity,
          price: Number(d.price ?? 0),
        })),
      };
    });
  }

  async cancelOrder(orderId: string, userId: string) {
    const shippingDetail = await this.shippingDetailRepository.findOne({
      where: { order: { id: orderId }, shipper: { id: userId } },
    });
    if (!shippingDetail) {
      throw new ForbiddenException('You are not the shipper for this order');
    }

    const order = await this.orderDelivery.cancelDelivery(orderId);
    shippingDetail.status = ShippingStatus.CANCELLED;
    await this.shippingDetailRepository.save(shippingDetail);

    const shipper = await this.shipperProfileRepository.findOne({ where: { userId } });
    if (shipper) {
      shipper.activeDeliveries = Math.max((shipper.activeDeliveries || 1) - 1, 0);
      shipper.failedDeliveries = (shipper.failedDeliveries || 0) + 1;
      await this.shipperProfileRepository.save(shipper);
    }
    return order;
  }

  async rejectOrder(
    orderId: string,
    shipperId: string,
    responseTimeSeconds: number = 0,
  ): Promise<{
    message: string;
    warning?: string;
    rejectionRatio?: number;
    stats?: { rejectedOrders: number; completedDeliveries: number; totalOrders: number };
  }> {
    const pendingAssignment =
      await this.pendingAssignmentService.getPendingAssignmentForShipper(shipperId);
    if (!pendingAssignment || pendingAssignment.orderId !== orderId) {
      throw new ForbiddenException('This order is not currently offered to this shipper');
    }

    const shipper = await this.shipperProfileRepository.findOne({ where: { userId: shipperId } });
    if (!shipper) {
      throw new NotFoundException('Shipper not found');
    }

    try {
      await this.pendingAssignmentService.markOfferRejected(orderId, shipperId);
      this.logger.log(
        `Reset isSentToShipper flag to false for order ${orderId} after rejection by shipper ${shipperId}`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to reset isSentToShipper flag for order ${orderId}: ${errorMessage(error)}`,
      );
    }

    shipper.activeDeliveries = Math.max((shipper.activeDeliveries || 1) - 1, 0);
    shipper.failedDeliveries = (shipper.failedDeliveries || 0) + 1;
    shipper.rejectedOrders = (shipper.rejectedOrders || 0) + 1;
    shipper.responseTimeMinutes = Math.max(
      (shipper.responseTimeMinutes || 0) + Math.ceil(responseTimeSeconds / 60),
      0,
    );

    const rejectionCheckResult = this.checkRejectionRatio(shipper);

    if (rejectionCheckResult.shouldBan) {
      shipper.certificateStatus = SHIPPER_PROFILE_STATUS.REJECTED;
      await this.shipperProfileRepository.save(shipper);
      throw new ConflictException(`Shipper has been banned due to ${rejectionCheckResult.reason}`);
    }

    if (shipper.responseTimeMinutes > 60) {
      shipper.certificateStatus = SHIPPER_PROFILE_STATUS.REJECTED;
      await this.shipperProfileRepository.save(shipper);
      throw new ConflictException('Shipper has been rejected due to high response time');
    }

    await this.shipperProfileRepository.save(shipper);

    const response: {
      message: string;
      warning?: string;
      rejectionRatio?: number;
      stats?: { rejectedOrders: number; completedDeliveries: number; totalOrders: number };
    } = { message: 'Order rejected successfully' };

    if (rejectionCheckResult.warning) {
      response.warning = rejectionCheckResult.warning;
      response.rejectionRatio = rejectionCheckResult.rejectionRatio;
      response.stats = {
        rejectedOrders: shipper.rejectedOrders,
        completedDeliveries: shipper.completedDeliveries,
        totalOrders: shipper.rejectedOrders + shipper.completedDeliveries,
      };
    }

    return response;
  }

  protected checkRejectionRatio(shipper: ShipperProfile): {
    shouldBan: boolean;
    warning?: string;
    reason?: string;
    rejectionRatio?: number;
  } {
    const completedDeliveries = shipper.completedDeliveries || 0;
    const rejectedOrders = shipper.rejectedOrders || 0;
    const totalOrders = completedDeliveries + rejectedOrders;

    if (totalOrders < 10) {
      return { shouldBan: false };
    }

    const rejectionRatio = rejectedOrders / totalOrders;

    if (totalOrders >= 50 && rejectionRatio > 0.7) {
      return {
        shouldBan: true,
        reason: 'tỷ lệ từ chối đơn hàng quá cao (>70% trong 50+ đơn hàng bị từ chối)',
        rejectionRatio,
      };
    }

    if (totalOrders >= 30 && rejectionRatio > 0.8) {
      return {
        shouldBan: true,
        reason: 'tỷ lệ từ chối đơn hàng quá cao (>80% trong 30+ đơn hàng bị từ chối)',
        rejectionRatio,
      };
    }

    if (rejectedOrders >= 20 && completedDeliveries === 0) {
      return {
        shouldBan: true,
        reason: 'không có đơn hàng nào được hoàn thành sau 20 lần từ chối',
        rejectionRatio,
      };
    }

    if (totalOrders >= 20 && rejectionRatio > 0.6) {
      return {
        shouldBan: false,
        warning:
          'Cảnh báo: Tỷ lệ từ chối đơn hàng cao. Tiếp tục từ chối đơn hàng có thể dẫn đến việc tài khoản bị đình chỉ.',
        rejectionRatio,
      };
    }

    if (totalOrders >= 15 && rejectionRatio > 0.75) {
      return {
        shouldBan: false,
        warning:
          'Cảnh báo nghiêm trọng: Tỷ lệ từ chối đơn hàng rất cao. Tài khoản của bạn có nguy cơ bị đình chỉ.',
        rejectionRatio,
      };
    }

    if (rejectedOrders >= 10 && completedDeliveries <= 2) {
      return {
        shouldBan: false,
        warning:
          'Cảnh báo: Bạn có rất ít đơn hàng hoàn thành so với số đơn từ chối. Vui lòng bắt đầu nhận đơn hàng.',
        rejectionRatio,
      };
    }

    return { shouldBan: false };
  }
}
