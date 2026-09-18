import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { haversineDistance } from 'src/common/utils/geo.util';
import {
  SHIPPER_OFFER_REQUESTED_EVENT,
  type ShipperOfferRequestedEvent,
} from 'src/common/events/shipper-offer-requested.event';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import { ShippingDetail } from 'src/entities/shippingDetail.entity';
import {
  OrderDeliveryDispatchReaderService,
  type DeliveryDispatchCandidate,
} from 'src/features/orders/order-delivery-dispatch-reader.public-api';
import { Repository } from 'typeorm';
import {
  DELIVERY_ASSIGNMENT_QUEUE,
  DELIVERY_ASSIGNMENT_QUEUE_PORT,
  type DeliveryAssignmentJobData,
  type DeliveryAssignmentQueuePort,
} from '../../contracts/delivery-assignment-queue.port';
import {
  AcceptDeliveryCommand,
  OfferDeliveryCommand,
  ReassignDeliveryCommand,
  RejectDeliveryCommand,
} from '../../contracts/delivery-dispatch.commands';
import {
  DELIVERY_DISPATCH_POLICY,
  DeliveryDispatchPolicy,
} from '../../contracts/delivery-dispatch.policy';
import {
  PENDING_ASSIGNMENT_STORE,
  PendingAssignmentState,
  type PendingAssignmentStorePort,
} from '../../contracts/pending-assignment-store.port';
import { ShipperService } from '../shipper/shipper.service';
import { ActiveShipperTrackerService } from './active-shipper-tracker.service';

interface ActiveShipper {
  shipperId: string;
  latitude: number;
  longitude: number;
  maxDistance: number;
  lastSeen: Date;
}

export type ExpiredPendingAssignment = Omit<PendingAssignmentState, 'createdAt'> & {
  order: DeliveryDispatchCandidate;
  createdAt: Date;
};

/**
 * DeliveryDispatchService: Dịch vụ điều phối trung tâm của phân hệ Giao vận.
 * Chịu trách nhiệm:
 * 1. Ghép cuốc (Matching), quét shipper khả dụng gần nhất theo toạ độ GPS.
 * 2. Giữ cuốc độc quyền 2 phút (Hold timeout), tái điều phối (Reassign/Retry).
 * 3. Tiếp nhận các lệnh điều phối trực tiếp (Offer, Accept, Reject, Reassign).
 */
@Injectable()
export class DeliveryDispatchService {
  private readonly logger = new Logger(DeliveryDispatchService.name);

  constructor(
    private readonly orderDispatchReader: OrderDeliveryDispatchReaderService,
    @InjectRepository(ShippingDetail)
    private readonly shippingDetailRepository: Repository<ShippingDetail>,
    @Inject(DELIVERY_ASSIGNMENT_QUEUE_PORT)
    private readonly queueService: DeliveryAssignmentQueuePort,
    @Inject(PENDING_ASSIGNMENT_STORE)
    private readonly store: PendingAssignmentStorePort,
    private readonly shipperService: ShipperService,
    private readonly activeShipperTracker: ActiveShipperTrackerService,
    private readonly eventBus: InProcessEventBus,
  ) {}

  // ==========================================
  // DISPATCH COMMANDS (Offer / Accept / Reject / Reassign)
  // ==========================================

  async offerDelivery(command: OfferDeliveryCommand) {
    DeliveryDispatchPolicy.assertCommandActor(command.actorId);
    DeliveryDispatchPolicy.assertOrderId(command.orderId);
    return this.shipperService.requestOrderAssignment(command.orderId, command.actorId);
  }

  async acceptDelivery(command: AcceptDeliveryCommand) {
    DeliveryDispatchPolicy.assertCommandActor(command.actorId);
    const assignment = await this.shipperService.getPendingAssignmentForShipper(command.actorId);
    if (!assignment) {
      DeliveryDispatchPolicy.assertOwnership(assignment, command.assignmentId, command.actorId);
      return null;
    }
    DeliveryDispatchPolicy.assertOwnership(assignment, command.assignmentId, command.actorId);
    DeliveryDispatchPolicy.assertAcceptable(new Date(assignment.expiresAt));
    return this.shipperService.acceptAssignment(command.assignmentId, command.actorId);
  }

  async rejectDelivery(command: RejectDeliveryCommand) {
    DeliveryDispatchPolicy.assertCommandActor(command.actorId);
    const assignment = await this.shipperService.getPendingAssignmentForShipper(command.actorId);
    if (!assignment) {
      DeliveryDispatchPolicy.assertOwnership(assignment, command.assignmentId, command.actorId);
      return null;
    }
    DeliveryDispatchPolicy.assertOwnership(assignment, command.assignmentId, command.actorId);
    return this.shipperService.rejectAssignment(command.assignmentId, command.actorId);
  }

  async reassignDelivery(command: ReassignDeliveryCommand) {
    DeliveryDispatchPolicy.assertCommandActor(command.actorId);
    const assignment = await this.shipperService.getPendingAssignmentForOrder(command.orderId);
    DeliveryDispatchPolicy.assertCanReassign(
      command.actorId,
      assignment?.shipperId ?? null,
      command.actorRole,
    );
    return this.shipperService.reassignOrder(command.orderId);
  }

  // ==========================================
  // DISPATCH SCHEDULING & QUEUE PROCESSING
  // ==========================================

  @Cron(CronExpression.EVERY_5_SECONDS)
  async checkPendingAssignmentsAndCreateJobs(): Promise<void> {
    try {
      const assignments = await this.store.getDueAssignments(50);

      for (const assignment of assignments) {
        const hasLock = await this.store.acquireProcessingLock(assignment.id);
        if (!hasLock) {
          continue;
        }

        if (await this.shouldSkipSentAssignment(assignment)) {
          continue;
        }

        const isValid = await this.validatePendingAssignment(assignment);
        if (!isValid) {
          await this.store.remove(assignment);
          continue;
        }

        const jobId = await this.createJobForPendingAssignment(assignment);
        if (jobId) {
          await this.store.removeDue(assignment.id);
        }
      }
    } catch (error) {
      this.logger.error('Error during pending assignment check:', error);
    }
  }

  async getExpiredAssignments(cutoffDate: Date): Promise<ExpiredPendingAssignment[]> {
    const assignments = await this.store.getExpiredAssignments(cutoffDate);
    const result: ExpiredPendingAssignment[] = [];

    for (const assignment of assignments) {
      const order = await this.findDispatchCandidate(assignment.orderId);
      if (order) {
        result.push({
          ...assignment,
          order,
          createdAt: new Date(assignment.createdAt),
        });
      }
    }

    return result;
  }

  async removePendingAssignmentById(assignmentId: string): Promise<boolean> {
    const assignment = await this.store.getById(assignmentId);
    if (!assignment) {
      return false;
    }

    await this.store.remove(assignment);
    return true;
  }

  async addPendingAssignment(
    orderId: string,
    priority: number = 1,
  ): Promise<PendingAssignmentState> {
    const existing = await this.store.getByOrderId(orderId);
    if (existing) {
      return existing;
    }

    await this.validateOrderForAssignment(orderId);
    return this.store.createOrGet(orderId, priority);
  }

  async removePendingAssignment(orderId: string): Promise<void> {
    await this.store.removeByOrderId(orderId);
  }

  async markOfferRejected(orderId: string, shipperId: string): Promise<void> {
    const assignment = await this.store.getByOrderId(orderId);
    if (!assignment) {
      return;
    }

    await this.store.clearHoldForShipper(shipperId);
    await this.store.addNotifiedShipper(orderId, shipperId);
    assignment.isSentToShipper = false;
    assignment.targetShipperId = null;
    await this.scheduleRetryForAssignment(assignment, 0);
  }

  async getPendingAssignmentForShipper(shipperId: string) {
    const hold = await this.store.getHoldForShipper(shipperId);
    if (!hold) {
      return null;
    }

    return {
      assignmentId: hold.assignmentId,
      orderId: hold.orderId,
      shipperId: hold.shipperId,
      expiresAt: new Date(hold.expiresAt),
    };
  }

  async getActiveHoldForOrder(orderId: string) {
    const hold = await this.store.getHoldForOrder(orderId);
    if (!hold) {
      return null;
    }

    return {
      assignmentId: hold.assignmentId,
      orderId: hold.orderId,
      shipperId: hold.shipperId,
      expiresAt: new Date(hold.expiresAt),
    };
  }

  async getPendingAssignmentForOrder(orderId: string) {
    return this.getActiveHoldForOrder(orderId);
  }

  async createShipperHold(orderId: string, shipperId: string, priority: number = 1) {
    const assignment = await this.addPendingAssignment(orderId, priority);
    assignment.isSentToShipper = true;
    assignment.targetShipperId = shipperId;
    await this.store.save(assignment);
    await this.store.markShipperNotified(assignment, shipperId);

    const hold = await this.store.getHoldForShipper(shipperId);
    return {
      assignmentId: assignment.id,
      orderId,
      shipperId,
      expiresAt: hold
        ? new Date(hold.expiresAt)
        : new Date(Date.now() + DELIVERY_DISPATCH_POLICY.offerHoldTtlSeconds * 1000),
    };
  }

  async getExcludedShipperIds(orderId: string): Promise<string[]> {
    return this.store.getExcludedShipperIds(orderId);
  }

  async processShipperAssignmentJobData(
    jobId: string,
    data: DeliveryAssignmentJobData,
  ): Promise<void> {
    if (!this.isValidJobData(data)) {
      this.logger.error(`Received invalid job data: ${JSON.stringify(data)}`);
      throw new Error('Invalid job data');
    }

    const { pendingAssignmentId, orderId } = data;
    const assignment = await this.store.getById(pendingAssignmentId);

    if (!assignment) {
      return;
    }

    try {
      const order = await this.findDispatchCandidate(orderId);
      if (!order || (await this.hasShippingDetail(orderId))) {
        await this.store.remove(assignment);
        return;
      }

      const nearestShipper = await this.findNearestAvailableShipper(order);
      if (!nearestShipper) {
        await this.scheduleRetryForAssignment(assignment);
        return;
      }

      const shippingFee = order.shippingFee ?? 0;
      const shipperEarnings = order.shipperEarnings ?? Math.round(shippingFee * 0.8);
      const distance = order.deliveryDistance ?? 0;

      await this.eventBus.publish<ShipperOfferRequestedEvent>(SHIPPER_OFFER_REQUESTED_EVENT, {
        orderId: order.orderId,
        targetShipperId: nearestShipper.shipperId,
        distanceKm: distance,
        priorityScore: assignment.priority,
        shippingFee,
        shipperEarnings,
        shipperCommissionRate: order.shipperCommissionRate ?? 0.8,
        estimatedDeliveryTime: order.estimatedDeliveryTime ?? 30,
      });

      assignment.isSentToShipper = true;
      assignment.targetShipperId = nearestShipper.shipperId;
      await this.store.save(assignment);
      await this.store.markShipperNotified(assignment, nearestShipper.shipperId);

      setTimeout(() => {
        void this.handleShipperResponseTimeout(assignment.id, nearestShipper.shipperId);
      }, DELIVERY_DISPATCH_POLICY.offerHoldTtlSeconds * 1000);
    } catch (error) {
      this.logger.error(`Error processing shipper assignment job ${jobId}:`, error);
      const latestAssignment = await this.store.getById(pendingAssignmentId);
      if (latestAssignment) {
        await this.scheduleRetryForAssignment(latestAssignment);
      }
      throw error;
    }
  }

  async onOrderAssigned(orderId: string): Promise<void> {
    await this.removePendingAssignment(orderId);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredAssignments(): Promise<void> {
    const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const expiredAssignments = await this.store.getExpiredAssignments(cutoffTime);

    for (const assignment of expiredAssignments) {
      await this.store.remove(assignment);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async logSystemStats(): Promise<void> {
    try {
      await Promise.all([
        this.store.count(),
        this.queueService.getQueueSize(DELIVERY_ASSIGNMENT_QUEUE),
        this.store.countReady(),
      ]);
    } catch (error) {
      this.logger.error('Error collecting pending assignment stats:', error);
    }
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  private async validatePendingAssignment(assignment: PendingAssignmentState): Promise<boolean> {
    const order = await this.findDispatchCandidate(assignment.orderId);
    if (!order || (await this.hasShippingDetail(assignment.orderId))) {
      return false;
    }

    const maxAttempts = DELIVERY_DISPATCH_POLICY.pendingAssignmentMaxAttempts;
    const maxAgeMinutes = DELIVERY_DISPATCH_POLICY.pendingAssignmentMaxAgeMinutes;
    const assignmentAge = Date.now() - new Date(assignment.createdAt).getTime();
    const isExpired = assignmentAge > maxAgeMinutes * 60 * 1000;

    return assignment.attemptCount < maxAttempts && !isExpired;
  }

  private async shouldSkipSentAssignment(assignment: PendingAssignmentState): Promise<boolean> {
    if (!assignment.isSentToShipper) {
      return false;
    }

    if (!assignment.targetShipperId) {
      assignment.isSentToShipper = false;
      await this.store.save(assignment);
      return false;
    }

    const hold = await this.store.getHoldForShipper(assignment.targetShipperId);
    if (hold) {
      return true;
    }

    assignment.isSentToShipper = false;
    assignment.targetShipperId = null;
    await this.scheduleRetryForAssignment(assignment, 0);
    return true;
  }

  private async createJobForPendingAssignment(
    assignment: PendingAssignmentState,
  ): Promise<string | null> {
    try {
      const jobData: DeliveryAssignmentJobData = {
        pendingAssignmentId: assignment.id,
        orderId: assignment.orderId,
        attempt: assignment.attemptCount + 1,
      };

      return this.queueService.addJob(DELIVERY_ASSIGNMENT_QUEUE, jobData, {
        attempts: 3,
        backoffDelayMs: 5000,
        priority: assignment.priority,
        jobId: `find-shipper:${assignment.id}:${assignment.attemptCount + 1}`,
        removeOnComplete: true,
        removeOnFail: 1000,
      });
    } catch (error) {
      this.logger.error(`Failed to create job for assignment ${assignment.id}:`, error);
      return null;
    }
  }

  private async findNearestAvailableShipper(
    order: DeliveryDispatchCandidate,
  ): Promise<ActiveShipper | null> {
    if (!order.restaurantLocation) {
      return null;
    }

    const restaurantLat = order.restaurantLocation.latitude;
    const restaurantLng = order.restaurantLocation.longitude;
    const alreadyNotified = await this.store.getNotifiedShippers(order.orderId);
    let nearestShipper: ActiveShipper | null = null;
    let shortestDistance = Infinity;

    for (const shipper of this.activeShipperTracker.getAllShippers()) {
      if (alreadyNotified.includes(shipper.shipperId)) {
        continue;
      }

      const distance = haversineDistance(
        shipper.latitude,
        shipper.longitude,
        restaurantLat,
        restaurantLng,
      );
      if (distance <= shipper.maxDistance && distance < shortestDistance) {
        shortestDistance = distance;
        nearestShipper = {
          shipperId: shipper.shipperId,
          latitude: shipper.latitude,
          longitude: shipper.longitude,
          maxDistance: shipper.maxDistance,
          lastSeen: shipper.lastSeen,
        };
      }
    }

    return nearestShipper;
  }

  private async scheduleRetryForAssignment(
    assignment: PendingAssignmentState,
    baseDelayMinutes = 1,
  ): Promise<void> {
    const maxRetries = DELIVERY_DISPATCH_POLICY.retryMaxAttempts;
    if (assignment.attemptCount >= maxRetries) {
      await this.store.remove(assignment);
      return;
    }

    const delayMinutes =
      baseDelayMinutes === 0
        ? 0
        : Math.min(baseDelayMinutes * Math.pow(2, assignment.attemptCount), 60);

    assignment.attemptCount += 1;
    assignment.lastAttemptAt = new Date().toISOString();
    assignment.nextAttemptAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
    await this.store.save(assignment);
  }

  private async validateOrderForAssignment(orderId: string): Promise<DeliveryDispatchCandidate> {
    const order = await this.findDispatchCandidate(orderId);

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (await this.hasShippingDetail(orderId)) {
      throw new Error(`Order ${orderId} is already assigned to a shipper`);
    }

    return order;
  }

  private async findDispatchCandidate(orderId: string): Promise<DeliveryDispatchCandidate | null> {
    return this.orderDispatchReader.findConfirmedDispatchCandidate(orderId);
  }

  private async hasShippingDetail(orderId: string): Promise<boolean> {
    return Boolean(
      await this.shippingDetailRepository.exist({ where: { order: { id: orderId } } }),
    );
  }

  private async handleShipperResponseTimeout(
    assignmentId: string,
    shipperId: string,
  ): Promise<void> {
    const assignment = await this.store.getById(assignmentId);
    if (!assignment || assignment.targetShipperId !== shipperId) {
      return;
    }

    const order = await this.findDispatchCandidate(assignment.orderId);

    if (!order || (await this.hasShippingDetail(assignment.orderId))) {
      await this.store.remove(assignment);
      return;
    }

    await this.store.clearHoldForShipper(shipperId);
    assignment.isSentToShipper = false;
    assignment.targetShipperId = null;
    await this.scheduleRetryForAssignment(assignment);
  }

  private isValidJobData(data: unknown): data is DeliveryAssignmentJobData {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const job = data as Partial<DeliveryAssignmentJobData>;
    return (
      typeof job.pendingAssignmentId === 'string' &&
      typeof job.orderId === 'string' &&
      typeof job.attempt === 'number'
    );
  }
}

/** Backward compatibility alias */
export const DeliveryAssignmentScheduler = DeliveryDispatchService;
export type DeliveryAssignmentScheduler = DeliveryDispatchService;
