import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DELIVERY_ASSIGNMENT_CLAIMED_EVENT,
  DELIVERY_ASSIGNMENT_REJECTED_EVENT,
  DELIVERY_ASSIGNMENT_REQUESTED_EVENT,
  type DeliveryAssignmentClaimedEvent,
  type DeliveryAssignmentRejectedEvent,
  type DeliveryAssignmentRequestedEvent,
} from 'src/common/events/delivery-assignment.events';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import { OutboxService } from 'src/common/events/outbox.service';
import { ShipperProfile } from 'src/entities/shipperProfile.entity';
import { ShippingDetail, ShippingStatus } from 'src/entities/shippingDetail.entity';
import { Repository } from 'typeorm';
import { SHIPPER_PROFILE_STATUS } from '../../types/shipper-profile.types';

/**
 * Durable assignment saga.
 *
 * Delivery first reserves its ShippingDetail and stores an Outbox request. Orders then owns
 * the order-state transition. The follow-up event either activates or cancels the reservation.
 */
@Injectable()
export class DeliveryAssignmentSagaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeliveryAssignmentSagaService.name);
  private readonly unsubscribers: Array<() => void> = [];

  constructor(
    @InjectRepository(ShippingDetail)
    private readonly shippingDetailRepository: Repository<ShippingDetail>,
    @InjectRepository(ShipperProfile)
    private readonly shipperProfileRepository: Repository<ShipperProfile>,
    private readonly outboxService: OutboxService,
    private readonly eventBus: InProcessEventBus,
  ) {}

  onModuleInit(): void {
    this.unsubscribers.push(
      this.eventBus.subscribe<DeliveryAssignmentClaimedEvent>(
        DELIVERY_ASSIGNMENT_CLAIMED_EVENT,
        (event) => this.activate(event),
      ),
      this.eventBus.subscribe<DeliveryAssignmentRejectedEvent>(
        DELIVERY_ASSIGNMENT_REJECTED_EVENT,
        (event) => this.cancelReservation(event),
      ),
    );
  }

  onModuleDestroy(): void {
    this.unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
  }

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

  private async activate(event: DeliveryAssignmentClaimedEvent): Promise<void> {
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

  private async cancelReservation(event: DeliveryAssignmentRejectedEvent): Promise<void> {
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
