import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DELIVERY_ASSIGNMENT_REQUESTED_EVENT,
  type DeliveryAssignmentClaimedEvent,
  type DeliveryAssignmentRejectedEvent,
  type DeliveryAssignmentRequestedEvent,
} from 'src/common/events/delivery-assignment.events';
import {
  DELIVERY_COMPLETED_EVENT,
  type DeliveryCompletedEvent,
} from 'src/common/events/delivery-completed.event';
import { OutboxService } from 'src/common/events/outbox.service';
import { DeliveryEarningsEvent } from 'src/entities/deliveryEarningsEvent.entity';
import { ShipperProfile } from 'src/entities/shipperProfile.entity';
import { ShippingDetail, ShippingStatus } from 'src/entities/shippingDetail.entity';
import { OrderDeliveryService, type DeliveryCompletionOrder } from 'src/features/orders/public-api';
import { EntityManager, Repository } from 'typeorm';
import { SHIPPER_PROFILE_STATUS } from '../types/shipper-profile.types';

type CompletionResponse = {
  message: string;
  earnings: number;
  earningsBreakdown?: Record<string, number>;
  isOnTime?: boolean;
  deliveryTime?: number;
  totalCompletedDeliveries?: number;
  distance?: number;
  orderValue?: number | null;
};

export interface DeliveryEarningsProjection {
  shipperId: string;
  completedDeliveries: number;
  totalEarnings: number;
  averageDeliveryTime: number;
  onTimeDeliveries: number;
  lateDeliveries: number;
  dailyEarnings: number;
  weeklyEarnings: number;
  monthlyEarnings: number;
}

/**
 * Owns Delivery trip transactions and earnings projection. Orders alone changes Order.status.
 * Each write flow keeps its own transaction and durable Outbox boundary.
 */
@Injectable()
export class DeliveryTripService {
  private readonly logger = new Logger(DeliveryTripService.name);

  constructor(
    @InjectRepository(ShippingDetail)
    private readonly shippingDetailRepository: Repository<ShippingDetail>,
    @InjectRepository(ShipperProfile)
    private readonly shipperProfileRepository: Repository<ShipperProfile>,
    @InjectRepository(DeliveryEarningsEvent)
    private readonly eventRepository: Repository<DeliveryEarningsEvent>,
    private readonly orderDelivery: OrderDeliveryService,
    private readonly outboxService: OutboxService,
  ) {}

  async assign(
    orderId: string,
    shipperId: string,
    responseTimeSeconds: number,
  ): Promise<ShippingDetail> {
    const assignment = await this.shippingDetailRepository.manager.transaction(async (manager) => {
      const shippingDetails = manager.getRepository(ShippingDetail);
      const shipperProfiles = manager.getRepository(ShipperProfile);
      const existing = await shippingDetails.findOne({
        where: { order: { id: orderId } },
        relations: ['shipper'],
        lock: { mode: 'pessimistic_write' },
      });
      if (existing && existing.shipper?.id !== shipperId) {
        throw new ConflictException('Order already assigned to a shipper');
      }
      if (existing && existing.status === ShippingStatus.CANCELLED) {
        throw new ConflictException('Order assignment was cancelled');
      }

      let shippingDetail = existing;
      if (!shippingDetail) {
        const profile = await shipperProfiles.findOne({
          where: { userId: shipperId },
          lock: { mode: 'pessimistic_write' },
        });
        this.assertEligible(profile, shipperId);
        shippingDetail = shippingDetails.create({
          order: { id: orderId },
          shipper: { id: shipperId },
          status: ShippingStatus.PENDING,
          estimatedDeliveryTime: new Date(Date.now() + 30 * 60 * 1000),
        });
        profile.activeDeliveries += 1;
        profile.responseTimeMinutes = Math.max(
          profile.responseTimeMinutes + Math.ceil(responseTimeSeconds / 60),
          1,
        );
        await shippingDetails.save(shippingDetail);
        await shipperProfiles.save(profile);
      }

      const event = await this.outboxService.enqueue(manager, {
        eventType: DELIVERY_ASSIGNMENT_REQUESTED_EVENT,
        aggregateType: 'delivery',
        aggregateId: orderId,
        idempotencyKey: `delivery-assignment-requested:${orderId}`,
        payload: {
          orderId,
          shipperId,
          shippingDetailId: shippingDetail.id,
        } satisfies DeliveryAssignmentRequestedEvent,
      });
      return { shippingDetail, eventId: event.id };
    });

    try {
      await this.outboxService.dispatchAfterCommit(assignment.eventId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Delivery assignment dispatch deferred for order ${orderId}: ${message}`);
    }

    return (
      (await this.shippingDetailRepository.findOne({
        where: { id: assignment.shippingDetail.id },
        relations: ['shipper'],
      })) ?? assignment.shippingDetail
    );
  }

  async activate(event: DeliveryAssignmentClaimedEvent): Promise<void> {
    await this.shippingDetailRepository.manager.transaction(async (manager) => {
      const shippingDetails = manager.getRepository(ShippingDetail);
      const shippingDetail = await shippingDetails.findOne({
        where: { id: event.shippingDetailId },
        relations: ['shipper'],
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !shippingDetail ||
        shippingDetail.shipper?.id !== event.shipperId ||
        shippingDetail.status !== ShippingStatus.PENDING
      ) {
        return;
      }

      shippingDetail.status = ShippingStatus.SHIPPING;
      await shippingDetails.save(shippingDetail);
    });
  }

  async cancelReservation(event: DeliveryAssignmentRejectedEvent): Promise<void> {
    await this.shippingDetailRepository.manager.transaction(async (manager) => {
      const shippingDetails = manager.getRepository(ShippingDetail);
      const shipperProfiles = manager.getRepository(ShipperProfile);
      const shippingDetail = await shippingDetails.findOne({
        where: { id: event.shippingDetailId },
        relations: ['shipper'],
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !shippingDetail ||
        shippingDetail.shipper?.id !== event.shipperId ||
        shippingDetail.status !== ShippingStatus.PENDING
      ) {
        return;
      }

      shippingDetail.status = ShippingStatus.CANCELLED;
      await shippingDetails.save(shippingDetail);
      const profile = await shipperProfiles.findOne({
        where: { userId: event.shipperId },
        lock: { mode: 'pessimistic_write' },
      });
      if (profile) {
        profile.activeDeliveries = Math.max(profile.activeDeliveries - 1, 0);
        await shipperProfiles.save(profile);
      }
    });
  }

  async complete(orderId: string, shipperId: string): Promise<CompletionResponse> {
    const completion = await this.shippingDetailRepository.manager.transaction(async (manager) => {
      const shippingDetails = manager.getRepository(ShippingDetail);
      const shipperProfiles = manager.getRepository(ShipperProfile);
      const shippingDetail = await shippingDetails.findOne({
        where: { order: { id: orderId } },
        relations: ['shipper'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!shippingDetail) throw new NotFoundException('Không tìm thấy thông tin vận chuyển');
      if (shippingDetail.shipper?.id !== shipperId) {
        throw new ForbiddenException('You are not assigned to this order');
      }

      const order = await this.orderDelivery.findForCompletion(orderId);
      if (!order) throw new NotFoundException('Đơn hàng không tồn tại');
      if (shippingDetail.status === ShippingStatus.COMPLETED) {
        return {
          alreadyCompleted: true,
          eventId: undefined,
          response: this.alreadyCompletedResponse(order),
        };
      }
      if (order.status !== 'delivering') {
        throw new BadRequestException('Order must be delivering before completion');
      }

      const shipperProfile = await shipperProfiles.findOne({
        where: { userId: shipperId },
        lock: { mode: 'pessimistic_write' },
      });
      const actualDeliveryTime = new Date();
      shippingDetail.status = ShippingStatus.COMPLETED;
      shippingDetail.actualDeliveryTime = actualDeliveryTime;
      const deliveryTime = shippingDetail.estimatedDeliveryTime
        ? Math.abs(actualDeliveryTime.getTime() - shippingDetail.estimatedDeliveryTime.getTime()) /
          (1000 * 60)
        : 0;
      const isOnTime = deliveryTime <= (order.estimatedDeliveryTime ?? 30);
      const completedDeliveries = shipperProfile?.completedDeliveries ?? 0;
      const earnings = this.calculateEarnings(order, completedDeliveries, isOnTime);

      await shippingDetails.save(shippingDetail);
      const event = await this.outboxService.enqueue(manager, {
        eventType: DELIVERY_COMPLETED_EVENT,
        aggregateType: 'delivery',
        aggregateId: orderId,
        idempotencyKey: `delivery-completed:${orderId}`,
        payload: {
          orderId,
          customerId: order.customerId,
          shipperId,
          shippingDetailId: shippingDetail.id,
          completedAt: actualDeliveryTime.toISOString(),
          earnings: earnings.total,
          deliveryTimeMinutes: Math.round(deliveryTime),
          onTime: isOnTime,
        } satisfies DeliveryCompletedEvent,
      });
      return {
        alreadyCompleted: false,
        eventId: event.id,
        response: {
          message: 'Đơn hàng đã được hoàn thành',
          earnings: earnings.total,
          earningsBreakdown: earnings,
          isOnTime,
          deliveryTime: Math.round(deliveryTime),
          totalCompletedDeliveries: completedDeliveries + 1,
          distance: order.deliveryDistance ?? 2,
          orderValue: order.total,
        },
      };
    });

    if (!completion.alreadyCompleted && completion.eventId) {
      try {
        await this.outboxService.dispatchAfterCommit(completion.eventId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Delivery completion dispatch deferred for order ${orderId}: ${message}`);
      }
    }
    return completion.response;
  }

  async project(event: DeliveryCompletedEvent): Promise<boolean> {
    try {
      return await this.eventRepository.manager.transaction(async (manager) => {
        const events = manager.getRepository(DeliveryEarningsEvent);
        const existing = await events.findOne({
          where: { idempotencyKey: `delivery-completed:${event.orderId}` },
        });
        if (existing) return false;
        await events.save(
          events.create({
            idempotencyKey: `delivery-completed:${event.orderId}`,
            orderId: event.orderId,
            shipperId: event.shipperId,
            earnings: event.earnings,
            completedAt: new Date(event.completedAt),
            deliveryTimeMinutes: event.deliveryTimeMinutes,
            onTime: event.onTime,
          }),
        );
        await this.rebuildProfile(manager, event.shipperId);
        return true;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        this.logger.debug(`DeliveryCompleted already projected for order ${event.orderId}`);
        return false;
      }
      throw error;
    }
  }

  async rebuild(shipperId: string): Promise<DeliveryEarningsProjection> {
    return this.eventRepository.manager.transaction((manager) =>
      this.rebuildProfile(manager, shipperId),
    );
  }

  async rebuildAll(): Promise<number> {
    const profiles = await this.shipperProfileRepository.find();
    for (const profile of profiles) await this.rebuild(profile.userId);
    return profiles.length;
  }

  private async rebuildProfile(
    manager: EntityManager,
    shipperId: string,
  ): Promise<DeliveryEarningsProjection> {
    const events = manager.getRepository(DeliveryEarningsEvent);
    const profiles = manager.getRepository(ShipperProfile);
    const entries = await events.find({ where: { shipperId } });
    const profile =
      (await profiles.findOne({
        where: { userId: shipperId },
        lock: { mode: 'pessimistic_write' },
      })) ?? profiles.create({ userId: shipperId });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    const dayOfWeek = startOfWeek.getDay() || 7;
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek + 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sum = (items: DeliveryEarningsEvent[]) =>
      items.reduce((total, entry) => total + Number(entry.earnings || 0), 0);
    const inPeriod = (from: Date) => entries.filter((entry) => entry.completedAt >= from);
    const durations = entries
      .map((entry) => entry.deliveryTimeMinutes)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const dailyEntries = inPeriod(startOfDay);
    const weeklyEntries = inPeriod(startOfWeek);
    const monthlyEntries = inPeriod(startOfMonth);

    profile.completedDeliveries = entries.length;
    profile.totalEarnings = sum(entries);
    profile.averageDeliveryTime = durations.length
      ? durations.reduce((total, value) => total + value, 0) / durations.length
      : 0;
    profile.onTimeDeliveries = entries.filter((entry) => entry.onTime === true).length;
    profile.lateDeliveries = entries.filter((entry) => entry.onTime === false).length;
    profile.dailyEarnings = sum(dailyEntries);
    profile.weeklyEarnings = sum(weeklyEntries);
    profile.monthlyEarnings = sum(monthlyEntries);
    await profiles.save(profile);

    return {
      shipperId,
      completedDeliveries: profile.completedDeliveries,
      totalEarnings: profile.totalEarnings,
      averageDeliveryTime: profile.averageDeliveryTime,
      onTimeDeliveries: profile.onTimeDeliveries,
      lateDeliveries: profile.lateDeliveries,
      dailyEarnings: profile.dailyEarnings,
      weeklyEarnings: profile.weeklyEarnings,
      monthlyEarnings: profile.monthlyEarnings,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return Boolean(
      error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === '23505',
    );
  }

  private alreadyCompletedResponse(order: DeliveryCompletionOrder): CompletionResponse {
    return {
      message: 'Đơn hàng đã được hoàn thành trước đó',
      earnings: order.shipperEarnings ?? 0,
    };
  }

  private calculateEarnings(
    order: DeliveryCompletionOrder,
    completedDeliveries: number,
    isOnTime: boolean,
  ): Record<string, number> {
    const shippingFee = order.shippingFee ?? 25_000;
    const distance = order.deliveryDistance ?? 2;
    const baseEarnings = Math.round(shippingFee * 0.85);
    const distanceBonus = Math.max(0, (distance - 1) * 5_000);
    const orderValueBonus = Math.min(10_000, (order.total ?? 0) * 0.01);
    const hour = new Date().getHours();
    const timeBonus =
      (hour >= 11 && hour <= 13) || (hour >= 17 && hour <= 20)
        ? 5_000
        : hour >= 22 || hour <= 6
          ? 8_000
          : 0;
    const onTimeBonus = isOnTime ? 3_000 : 0;
    const performanceBonus =
      completedDeliveries > 100
        ? 2_000
        : completedDeliveries > 50
          ? 1_000
          : completedDeliveries > 20
            ? 500
            : 0;
    const calculated =
      baseEarnings + distanceBonus + orderValueBonus + timeBonus + onTimeBonus + performanceBonus;
    const total = order.shipperEarnings ?? Math.max(calculated, 20_000);
    return {
      baseEarnings,
      distanceBonus,
      orderValueBonus,
      timeBonus,
      onTimeBonus,
      performanceBonus,
      total,
    };
  }

  private assertEligible(
    profile: ShipperProfile | null,
    shipperId: string,
  ): asserts profile is ShipperProfile {
    if (!profile || profile.certificateStatus !== SHIPPER_PROFILE_STATUS.APPROVED) {
      throw new BadRequestException('Invalid or unapproved shipper');
    }
    if (!profile.isAvailable || profile.activeDeliveries >= profile.maxActiveDeliveries) {
      throw new ConflictException(`Shipper ${shipperId} is not available for another delivery`);
    }
  }
}
