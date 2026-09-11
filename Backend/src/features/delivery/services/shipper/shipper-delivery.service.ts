import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DELIVERY_COMPLETED_EVENT,
  DeliveryCompletedEvent,
} from 'src/common/events/delivery-completed.event';
import { OutboxService } from 'src/common/events/outbox.service';
import { Order } from 'src/entities/order.entity';
import {
  CertificateStatus,
  ShipperCertificateInfo,
} from 'src/entities/shipperCertificateInfo.entity';
import { ShippingDetail, ShippingStatus } from 'src/entities/shippingDetail.entity';
import { User } from 'src/entities/user.entity';
import { PendingAssignmentService } from 'src/infra/queue/pending-assignment.service';
import { pubSub } from 'src/pubsub';
import { Repository } from 'typeorm';
import { DeliveryAssignmentPolicy } from '../../contracts/delivery-dispatch.policy';

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
    @InjectRepository(Order)
    protected orderRepository: Repository<Order>,
    @InjectRepository(ShippingDetail)
    protected shippingDetailRepository: Repository<ShippingDetail>,
    @InjectRepository(User)
    protected userRepository: Repository<User>,
    @InjectRepository(ShipperCertificateInfo)
    protected readonly certRepo: Repository<ShipperCertificateInfo>,
    protected pendingAssignmentService: PendingAssignmentService,
    @Optional() protected readonly outboxService?: OutboxService,
  ) {}

  /**
   * Request order assignment (temporary hold)
   */
  async requestOrderAssignment(orderId: string, shipperId: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['restaurant', 'user', 'shippingDetail'],
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    DeliveryAssignmentPolicy.assertOfferable(order.status, Boolean(order.shippingDetail));

    const existingAssignment =
      await this.pendingAssignmentService.getPendingAssignmentForShipper(shipperId);

    if (existingAssignment?.orderId === orderId) {
      throw new ConflictException('You already have a pending assignment for this order');
    }

    const otherAssignment = await this.pendingAssignmentService.getActiveHoldForOrder(orderId);

    if (otherAssignment) {
      throw new ConflictException('Order is currently being considered by another shipper');
    }

    const shipper = await this.userRepository.findOne({
      where: { id: shipperId },
      relations: ['role', 'shipperCertificateInfo'],
    });

    DeliveryAssignmentPolicy.assertEligible(
      shipper?.role?.name,
      shipper?.shipperCertificateInfo?.status,
    );

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

    await pubSub.publish('orderAssignedToShipper', {
      orderAssignedToShipper: {
        orderId: assignment.orderId,
        shipperId,
      },
    });

    this.logger.log(`Order ${assignment.orderId} accepted by shipper ${shipperId}`);

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

    await this.reassignToOtherShippers(assignment.orderId);

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

  /**
   * Reassign order to other available shippers
   */
  protected async reassignToOtherShippers(orderId: string) {
    const order = await this.orderRepository.manager.transaction(async (manager) => {
      const orderRepository = manager.getRepository(Order);
      const shippingDetailRepository = manager.getRepository(ShippingDetail);

      const lockedOrder = await orderRepository
        .createQueryBuilder('order')
        .where('order.id = :orderId', { orderId })
        .setLock('pessimistic_write')
        .getOne();

      if (!lockedOrder || lockedOrder.status !== 'confirmed') {
        return null;
      }

      const existingShippingDetail = await shippingDetailRepository.findOne({
        where: { order: { id: orderId } },
      });

      if (existingShippingDetail) {
        return null;
      }

      return orderRepository.findOne({
        where: { id: orderId },
        relations: [
          'restaurant',
          'user',
          'address',
          'orderDetails',
          'orderDetails.food',
          'shippingDetail',
        ],
      });
    });

    if (order) {
      const excludedShipperIds = await this.pendingAssignmentService.getExcludedShipperIds(orderId);

      await pubSub.publish('orderReassignedToShippers', {
        orderReassignedToShippers: {
          order,
          excludedShipperIds,
        },
      });

      this.logger.log(`Order ${orderId} reassigned to remaining shippers`);
    } else {
      await this.pendingAssignmentService.removePendingAssignment(orderId);
    }
  }

  async getPendingAssignmentForOrder(orderId: string) {
    return this.pendingAssignmentService.getPendingAssignmentForOrder(orderId);
  }

  async reassignOrder(orderId: string) {
    await this.reassignToOtherShippers(orderId);
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

    const assignment = await this.orderRepository.manager.transaction(async (manager) => {
      const orderRepository = manager.getRepository(Order);
      const shippingDetailRepository = manager.getRepository(ShippingDetail);
      const userRepository = manager.getRepository(User);

      const order = await orderRepository
        .createQueryBuilder('order')
        .where('order.id = :orderId', { orderId })
        .setLock('pessimistic_write')
        .getOne();

      if (!order) {
        throw new BadRequestException('Order not found');
      }
      if (order.status !== 'confirmed') {
        throw new ConflictException('Order is no longer available for assignment');
      }

      const existingShippingDetail = await shippingDetailRepository.findOne({
        where: { order: { id: orderId } },
      });
      if (existingShippingDetail) {
        throw new ConflictException('Order already assigned to a shipper');
      }

      const shipper = await userRepository.findOne({
        where: { id: shipperId },
        relations: ['role', 'shipperCertificateInfo'],
      });
      if (!shipper) {
        throw new BadRequestException('Invalid or unapproved shipper');
      }
      DeliveryAssignmentPolicy.assertEligible(
        shipper?.role?.name,
        shipper?.shipperCertificateInfo?.status,
      );

      const shippingDetail = shippingDetailRepository.create({
        order,
        shipper,
        status: ShippingStatus.SHIPPING,
        estimatedDeliveryTime: new Date(Date.now() + 30 * 60 * 1000),
      });
      await shippingDetailRepository.save(shippingDetail);

      order.status = 'shipper_received';
      await orderRepository.save(order);

      shipper.activeDeliveries = (shipper.activeDeliveries || 0) + 1;
      shipper.responseTimeMinutes = Math.max(
        (shipper.responseTimeMinutes || 0) + Math.ceil(responseTimeSeconds / 60),
        1,
      );
      await userRepository.save(shipper);

      return { order, shippingDetail };
    });

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

    await pubSub.publish('orderStatusUpdated', {
      orderStatusUpdated: assignment.order,
    });

    this.logger.log(`Order ${orderId} assigned to shipper ${shipperId}`);

    return assignment.shippingDetail;
  }

  async getOrder(orderId: string, shipperId: string) {
    const shippingDetail = await this.shippingDetailRepository.findOne({
      where: {
        order: { id: orderId },
        shipper: { id: shipperId },
      },
      relations: [
        'order',
        'order.restaurant',
        'order.user',
        'order.address',
        'order.orderDetails',
        'order.orderDetails.food',
        'shipper',
      ],
    });

    this.logger.log(`Fetching order ${orderId} for shipper ${shipperId}`);

    if (!shippingDetail) {
      throw new NotFoundException('Shipping detail not found for this order and shipper');
    }

    const order = shippingDetail.order;

    if (!order) {
      throw new NotFoundException('Order not found');
    }
    this.logger.log(`Order ${orderId} found for shipper ${shipperId}`);

    if (shippingDetail.shipper.id !== shipperId) {
      throw new BadRequestException('You are not assigned to this order');
    }

    this.logger.log(`Order ${orderId} successfully retrieved for shipper ${shipperId}`);
    return order;
  }

  async startOrder(orderId: string, shipperId: string) {
    const shippingDetail = await this.shippingDetailRepository.findOne({
      where: { order: { id: orderId }, shipper: { id: shipperId } },
      relations: ['order', 'shipper'],
    });
    if (!shippingDetail) {
      throw new NotFoundException('Shipping detail not found for this order and shipper');
    }
    if (shippingDetail.shipper?.id !== shipperId) {
      throw new ForbiddenException('You are not assigned to this order');
    }

    const order = shippingDetail.order;
    if (order.status === 'delivering') {
      return order;
    }
    if (order.status !== 'shipper_received') {
      throw new BadRequestException('Order must be received by shipper before delivery starts');
    }

    order.status = 'delivering';
    shippingDetail.status = ShippingStatus.SHIPPING;
    await this.orderRepository.save(order);
    await this.shippingDetailRepository.save(shippingDetail);
    await pubSub.publish('orderStatusUpdated', { orderStatusUpdated: order });

    return order;
  }

  async getPendingAssignmentForShipper(shipperId: string) {
    return this.pendingAssignmentService.getPendingAssignmentForShipper(shipperId);
  }

  async cleanupExpiredData() {
    await this.pendingAssignmentService.cleanupExpiredAssignments();
  }

  async markOrderCompleted(orderId: string, shipperId: string) {
    const completion = await this.orderRepository.manager.transaction(async (manager) => {
      const orderRepository = manager.getRepository(Order);
      const shippingDetailRepository = manager.getRepository(ShippingDetail);
      const userRepository = manager.getRepository(User);

      const order = await orderRepository.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        throw new NotFoundException('Đơn hàng không tồn tại');
      }

      const shippingDetail = await shippingDetailRepository.findOne({
        where: { order: { id: orderId } },
        relations: ['shipper'],
      });
      if (!shippingDetail) {
        throw new NotFoundException('Không tìm thấy thông tin vận chuyển');
      }
      if (shippingDetail.shipper?.id !== shipperId) {
        throw new ForbiddenException('You are not assigned to this order');
      }
      if (order.status === 'completed' && shippingDetail.status === ShippingStatus.COMPLETED) {
        return {
          order,
          alreadyCompleted: true,
          deliveryCompletedEventId: undefined,
          response: {
            message: 'Đơn hàng đã được hoàn thành trước đó',
            earnings: order.shipperEarnings || 0,
          },
        };
      }
      if (order.status !== 'delivering') {
        throw new BadRequestException('Order must be delivering before completion');
      }

      const shipper = await userRepository.findOne({
        where: { id: shipperId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!shipper) {
        throw new NotFoundException('Shipper not found');
      }

      shippingDetail.status = ShippingStatus.COMPLETED;
      shippingDetail.actualDeliveryTime = new Date();

      const deliveryTime = shippingDetail.estimatedDeliveryTime
        ? Math.abs(
            shippingDetail.actualDeliveryTime.getTime() -
              shippingDetail.estimatedDeliveryTime.getTime(),
          ) /
          (1000 * 60)
        : 0;
      const isOnTime = deliveryTime <= (order.estimatedDeliveryTime || 30);
      const shippingFee = order.shippingFee || 25000;
      const distance = order.deliveryDistance || 2;
      const baseEarnings = Math.round(shippingFee * 0.85);
      const distanceBonus = Math.max(0, (distance - 1) * 5000);
      const orderValueBonus = Math.min(10000, (order.total || 0) * 0.01);
      const hour = new Date().getHours();
      const timeBonus =
        (hour >= 11 && hour <= 13) || (hour >= 17 && hour <= 20)
          ? 5000
          : hour >= 22 || hour <= 6
            ? 8000
            : 0;
      const onTimeBonus = isOnTime ? 3000 : 0;
      const completedDeliveries = shipper.completedDeliveries || 0;
      const performanceBonus =
        completedDeliveries > 100
          ? 2000
          : completedDeliveries > 50
            ? 1000
            : completedDeliveries > 20
              ? 500
              : 0;
      const calculatedEarnings =
        baseEarnings + distanceBonus + orderValueBonus + timeBonus + onTimeBonus + performanceBonus;
      const shipperEarnings = order.shipperEarnings || Math.max(calculatedEarnings, 20000);

      order.status = 'completed';
      order.shipperEarnings = shipperEarnings;
      shipper.completedDeliveries = completedDeliveries + 1;
      shipper.activeDeliveries = Math.max((shipper.activeDeliveries || 1) - 1, 0);
      shipper.totalEarnings = (shipper.totalEarnings || 0) + shipperEarnings;
      shipper.dailyEarnings = (shipper.dailyEarnings || 0) + shipperEarnings;
      shipper.weeklyEarnings = (shipper.weeklyEarnings || 0) + shipperEarnings;
      shipper.monthlyEarnings = (shipper.monthlyEarnings || 0) + shipperEarnings;
      shipper.averageDeliveryTime =
        ((shipper.averageDeliveryTime || 0) * completedDeliveries + deliveryTime) /
        shipper.completedDeliveries;
      if (isOnTime) {
        shipper.onTimeDeliveries = (shipper.onTimeDeliveries || 0) + 1;
      } else {
        shipper.lateDeliveries = (shipper.lateDeliveries || 0) + 1;
      }
      shipper.lastActiveAt = new Date();

      await shippingDetailRepository.save(shippingDetail);
      await orderRepository.save(order);
      await userRepository.save(shipper);

      const deliveryCompletedEvent = this.outboxService
        ? await this.outboxService.enqueue(manager, {
            eventType: DELIVERY_COMPLETED_EVENT,
            aggregateType: 'delivery',
            aggregateId: order.id,
            idempotencyKey: `delivery-completed:${order.id}`,
            payload: {
              orderId: order.id,
              shipperId,
              shippingDetailId: shippingDetail.id,
              completedAt: shippingDetail.actualDeliveryTime.toISOString(),
              earnings: shipperEarnings,
              deliveryTimeMinutes: Math.round(deliveryTime),
              onTime: isOnTime,
            } satisfies DeliveryCompletedEvent,
          })
        : null;

      return {
        order,
        alreadyCompleted: false,
        deliveryCompletedEventId: deliveryCompletedEvent?.id,
        response: {
          message: 'Đơn hàng đã được hoàn thành',
          earnings: shipperEarnings,
          earningsBreakdown: {
            baseEarnings,
            distanceBonus,
            orderValueBonus,
            timeBonus,
            onTimeBonus,
            performanceBonus,
            totalEarnings: shipperEarnings,
          },
          isOnTime,
          deliveryTime: Math.round(deliveryTime),
          totalCompletedDeliveries: shipper.completedDeliveries,
          distance,
          orderValue: order.total,
        },
      };
    });

    if (!completion.alreadyCompleted) {
      await pubSub.publish('orderStatusUpdated', {
        orderStatusUpdated: completion.order,
      });

      if (completion.deliveryCompletedEventId && this.outboxService) {
        try {
          await this.outboxService.dispatchAfterCommit(completion.deliveryCompletedEventId);
        } catch (error) {
          this.logger.error(
            `DeliveryCompleted dispatch deferred for order ${orderId}: ${errorMessage(error)}`,
          );
        }
      }
    }

    return completion.response;
  }

  async getCompletedOrdersByShipper(shipperId: string) {
    const completedDetails = await this.shippingDetailRepository.find({
      where: {
        shipper: { id: shipperId },
        status: ShippingStatus.COMPLETED,
      },
      relations: [
        'order',
        'order.orderDetails',
        'order.orderDetails.food',
        'order.restaurant',
        'order.user',
        'order.address',
      ],
      order: { actualDeliveryTime: 'DESC' },
    });

    return completedDetails.map((detail) => {
      const order = detail.order;
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
            name: d.food.name,
          },
          quantity: d.quantity,
          price: +d.price,
        })),
      };
    });
  }

  async cancelOrder(orderId: string, userId: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['shippingDetail', 'shippingDetail.shipper'],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== 'delivering') {
      throw new BadRequestException('Order is not currently being delivered');
    }
    if (order.shippingDetail?.shipper?.id !== userId) {
      throw new ForbiddenException('You are not the shipper for this order');
    }

    const shipper = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['shipperCertificateInfo'],
    });
    if (!shipper) {
      throw new NotFoundException('Shipper not found');
    }

    order.status = 'canceled';
    await this.orderRepository.save(order);

    await pubSub.publish('orderStatusUpdated', {
      orderStatusUpdated: order,
    });

    shipper.activeDeliveries = Math.max((shipper.activeDeliveries || 1) - 1, 0);
    shipper.failedDeliveries = (shipper.failedDeliveries || 0) + 1;
    await this.userRepository.save(shipper);
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

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['shippingDetail', 'shippingDetail.shipper'],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    await this.orderRepository.save(order);

    const shipper = await this.userRepository.findOne({
      where: { id: shipperId },
      relations: ['shipperCertificateInfo'],
    });
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
      if (shipper.shipperCertificateInfo) {
        shipper.shipperCertificateInfo.status = CertificateStatus.REJECTED;
        await this.certRepo.save(shipper.shipperCertificateInfo);
      }
      await this.userRepository.save(shipper);
      throw new ConflictException(`Shipper has been banned due to ${rejectionCheckResult.reason}`);
    }

    if (shipper.responseTimeMinutes > 60) {
      if (shipper.shipperCertificateInfo) {
        shipper.shipperCertificateInfo.status = CertificateStatus.REJECTED;
        await this.certRepo.save(shipper.shipperCertificateInfo);
      }
      await this.userRepository.save(shipper);
      throw new ConflictException('Shipper has been rejected due to high response time');
    }

    await this.userRepository.save(shipper);

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

  protected checkRejectionRatio(shipper: User): {
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
