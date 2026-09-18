import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ShipperProfile } from 'src/entities/shipperProfile.entity';
import { ShippingDetail, ShippingStatus } from 'src/entities/shippingDetail.entity';
import {
  OrderDeliveryLifecycleCommandService,
  OrderDeliveryShipperReaderService,
} from 'src/features/orders/order-delivery-shipper.public-api';
import { pubSub } from 'src/pubsub';
import { Repository } from 'typeorm';
import { DeliveryAssignmentPolicy } from '../../contracts/delivery-dispatch.policy';
import { SHIPPER_PROFILE_STATUS } from '../../types/shipper-profile.types';
import { DeliveryDispatchService } from '../dispatch/delivery-dispatch.service';
import { DeliveryAssignmentSagaService } from './delivery-assignment-saga.service';
import { DeliveryCompletionService } from './delivery-completion.service';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * ShipperDeliveryService handles delivery trips for Shippers:
 * Request assignment hold, accept, start, complete, reject, cancel and reassign deliveries.
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
    protected readonly deliveryAssignmentSagaService: DeliveryAssignmentSagaService,
    protected readonly deliveryCompletionService: DeliveryCompletionService,
    protected readonly orderLifecycleCommand: OrderDeliveryLifecycleCommandService,
    protected readonly orderShipperReader: OrderDeliveryShipperReaderService,
  ) {}

  /**
   * Request order assignment (temporary hold)
   */
  async requestOrderAssignment(orderId: string, shipperId: string) {
    const existingAssignment =
      await this.pendingAssignmentService.getPendingAssignmentForShipper(shipperId);

    if (existingAssignment?.orderId === orderId) {
      throw new ConflictException('You already have a pending assignment for this order');
    }

    const otherAssignment = await this.pendingAssignmentService.getActiveHoldForOrder(orderId);

    if (otherAssignment) {
      throw new ConflictException('Order is currently being considered by another shipper');
    }

    const profile = await this.shipperProfileRepository.findOne({ where: { userId: shipperId } });
    this.assertShipperCanReceiveOffer(profile);

    // DeliveryDispatchService validates that Orders still exposes a confirmed,
    // unassigned dispatch candidate through its narrow read API.
    await this.pendingAssignmentService.addPendingAssignment(orderId);
    const hold = await this.pendingAssignmentService.createShipperHold(orderId, shipperId);

    this.logger.log(`Temporary assignment created for order ${orderId} to shipper ${shipperId}`);

    return {
      assignmentId: hold.assignmentId,
      expiresAt: hold.expiresAt,
      message: 'You have 2 minutes to accept this order',
    };
  }

  /**
   * Accept the assignment and finalize order
   */
  async acceptAssignment(assignmentId: string, shipperId: string) {
    const assignment =
      await this.pendingAssignmentService.getPendingAssignmentForShipper(shipperId);

    if (!assignment) {
      throw new BadRequestException('Assignment not found or already processed');
    }

    DeliveryAssignmentPolicy.assertOwnership(assignment, assignmentId, shipperId);

    if (assignment.expiresAt < new Date()) {
      await this.pendingAssignmentService.markOfferRejected(assignment.orderId, shipperId);
      DeliveryAssignmentPolicy.assertAcceptable(assignment.expiresAt);
    }

    const result = await this.assignOrderToShipper(assignment.orderId, shipperId);

    if (result.status === ShippingStatus.SHIPPING) {
      await pubSub.publish('orderAssignedToShipper', {
        orderAssignedToShipper: {
          orderId: assignment.orderId,
          shipperId,
        },
      });
      this.logger.log(`Order ${assignment.orderId} accepted by shipper ${shipperId}`);
    } else {
      this.logger.warn(`Order ${assignment.orderId} assignment is pending Outbox processing`);
    }

    return result;
  }

  /**
   * Reject the assignment
   */
  async rejectAssignment(assignmentId: string, shipperId: string) {
    const assignment =
      await this.pendingAssignmentService.getPendingAssignmentForShipper(shipperId);

    if (!assignment) {
      throw new BadRequestException('Assignment not found or already processed');
    }

    DeliveryAssignmentPolicy.assertOwnership(assignment, assignmentId, shipperId);

    await this.pendingAssignmentService.markOfferRejected(assignment.orderId, shipperId);

    this.logger.log(`Order ${assignment.orderId} rejected by shipper ${shipperId}`);

    return { message: 'Order rejected successfully' };
  }

  /**
   * Auto-reject expired assignments
   */
  protected autoRejectAssignment(assignmentId: string): void {
    this.logger.warn(
      `autoRejectAssignment(${assignmentId}) is handled by Redis TTL and pending assignment cron`,
    );
  }

  async getPendingAssignmentForOrder(orderId: string) {
    return this.pendingAssignmentService.getPendingAssignmentForOrder(orderId);
  }

  async reassignOrder(orderId: string) {
    const activeHold = await this.pendingAssignmentService.getPendingAssignmentForOrder(orderId);
    if (activeHold) {
      await this.pendingAssignmentService.markOfferRejected(orderId, activeHold.shipperId);
    }
    await this.pendingAssignmentService.addPendingAssignment(orderId);
    return { message: 'Order queued for reassignment' };
  }

  /**
   * Assign an order to a shipper
   */
  async assignOrderToShipper(
    orderId: string,
    shipperId: string,
    responseTimeSeconds: number = 120,
  ) {
    const pendingAssignment =
      await this.pendingAssignmentService.getPendingAssignmentForShipper(shipperId);
    if (!pendingAssignment || pendingAssignment.orderId !== orderId) {
      throw new ForbiddenException('This order is not currently offered to this shipper');
    }

    const shippingDetail = await this.deliveryAssignmentSagaService.assign(
      orderId,
      shipperId,
      responseTimeSeconds,
    );

    if (shippingDetail.status === ShippingStatus.CANCELLED) {
      await this.pendingAssignmentService.removePendingAssignment(orderId);
      throw new ConflictException('Order is no longer available for assignment');
    }

    try {
      await this.pendingAssignmentService.removePendingAssignment(orderId);
      this.logger.log(
        `Removed order ${orderId} from pending assignments after assignment to shipper`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to remove order ${orderId} from pending assignments: ${errorMessage(error)}`,
      );
    }

    this.logger.log(`Order ${orderId} assigned to shipper ${shipperId}`);

    return shippingDetail;
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
    return this.orderShipperReader.getShipperOrder(orderId);
  }

  async startOrder(orderId: string, shipperId: string) {
    const shippingDetail = await this.shippingDetailRepository.findOne({
      where: { order: { id: orderId }, shipper: { id: shipperId } },
    });
    if (!shippingDetail) {
      throw new NotFoundException('Shipping detail not found for this order and shipper');
    }
    return this.orderLifecycleCommand.startDelivery(orderId);
  }

  async getPendingAssignmentForShipper(shipperId: string) {
    return this.pendingAssignmentService.getPendingAssignmentForShipper(shipperId);
  }

  async cleanupExpiredData() {
    await this.pendingAssignmentService.cleanupExpiredAssignments();
  }

  async markOrderCompleted(orderId: string, shipperId: string) {
    return this.deliveryCompletionService.complete(orderId, shipperId);
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
    const orders = await this.orderShipperReader.getShipperOrders(orderIds);

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

    const order = await this.orderLifecycleCommand.cancelDelivery(orderId);
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

  private assertShipperCanReceiveOffer(
    profile: ShipperProfile | null,
  ): asserts profile is ShipperProfile {
    if (!profile || profile.certificateStatus !== SHIPPER_PROFILE_STATUS.APPROVED) {
      throw new BadRequestException('Invalid or unapproved shipper');
    }
    if (!profile.isAvailable || profile.activeDeliveries >= profile.maxActiveDeliveries) {
      throw new ConflictException('Shipper is not available for another delivery');
    }
  }
}
