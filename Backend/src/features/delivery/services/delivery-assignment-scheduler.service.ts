import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DELIVERY_ASSIGNMENT_POLICY } from 'src/features/delivery/contracts/delivery-assignment.policy';
import { Order } from 'src/entities/order.entity';
import { haversineDistance } from 'src/common/utils/geo.util';
import { activeShipperTracker } from 'src/modules/order/order.resolver';
import { pubSub } from 'src/pubsub';
import { Repository } from 'typeorm';
import { FindShipperJobData, QueueNames } from '../../../infra/queue/queue.constants';
import { QueueService } from '../../../infra/queue/queue.service';
import {
  PendingAssignmentState,
  PendingAssignmentStore,
} from '../../../infra/queue/pending-assignment-store.service';

interface ActiveShipper {
  shipperId: string;
  latitude: number;
  longitude: number;
  maxDistance: number;
  lastSeen: Date;
}

export type ExpiredPendingAssignment = Omit<PendingAssignmentState, 'createdAt'> & {
  order: Order;
  createdAt: Date;
};

@Injectable()
export class DeliveryAssignmentScheduler {
  private readonly logger = new Logger(DeliveryAssignmentScheduler.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly queueService: QueueService,
    private readonly store: PendingAssignmentStore,
  ) {}

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
      const order = await this.findOrderForAssignment(assignment.orderId);
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

  async addPendingAssignment(orderId: string, priority: number = 1): Promise<PendingAssignmentState> {
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
        : new Date(Date.now() + DELIVERY_ASSIGNMENT_POLICY.offerHoldTtlSeconds * 1000),
    };
  }

  async getExcludedShipperIds(orderId: string): Promise<string[]> {
    return this.store.getExcludedShipperIds(orderId);
  }

  async processShipperAssignmentJobData(jobId: string, data: FindShipperJobData): Promise<void> {
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
      const order = await this.findOrderForAssignment(orderId);
      if (!order || order.status !== 'confirmed') {
        await this.store.remove(assignment);
        return;
      }

      const currentOrder = await this.orderRepository.findOne({
        where: { id: orderId },
        relations: ['shippingDetail'],
      });

      if (currentOrder?.shippingDetail) {
        await this.store.remove(assignment);
        return;
      }

      const nearestShipper = await this.findNearestAvailableShipper(order);
      if (!nearestShipper) {
        await this.scheduleRetryForAssignment(assignment);
        return;
      }

      const shippingFee = order.shippingFee || 0;
      const shipperEarnings = order.shipperEarnings || Math.round(shippingFee * 0.8);
      const distance = order.deliveryDistance || 0;

      await pubSub.publish('orderConfirmedForShippers', {
        orderConfirmedForShippers: {
          ...order,
          shipperEarnings,
          shippingFee,
        },
        targetShipperId: nearestShipper.shipperId,
        distanceKm: distance,
        priorityScore: assignment.priority,
        earningsInfo: {
          shippingFee,
          shipperEarnings,
          platformFee: shippingFee - shipperEarnings,
          netProfit: Math.max(0, shipperEarnings - distance * 3000),
          earningsPerKm: distance > 0 ? Math.round(shipperEarnings / distance) : 0,
        },
      });

      assignment.isSentToShipper = true;
      assignment.targetShipperId = nearestShipper.shipperId;
      await this.store.save(assignment);
      await this.store.markShipperNotified(assignment, nearestShipper.shipperId);

      setTimeout(() => {
        void this.handleShipperResponseTimeout(assignment.id, nearestShipper.shipperId);
      }, DELIVERY_ASSIGNMENT_POLICY.offerHoldTtlSeconds * 1000);
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
        this.queueService.getQueueSize(QueueNames.FIND_SHIPPER),
        this.store.countReady(),
      ]);
    } catch (error) {
      this.logger.error('Error collecting pending assignment stats:', error);
    }
  }

  private async validatePendingAssignment(assignment: PendingAssignmentState): Promise<boolean> {
    const order = await this.findOrderForAssignment(assignment.orderId);
    if (!order || order.status !== 'confirmed' || order.shippingDetail) {
      return false;
    }

    const maxAttempts = DELIVERY_ASSIGNMENT_POLICY.pendingAssignmentMaxAttempts;
    const maxAgeMinutes = DELIVERY_ASSIGNMENT_POLICY.pendingAssignmentMaxAgeMinutes;
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

  private async createJobForPendingAssignment(assignment: PendingAssignmentState): Promise<string | null> {
    try {
      const jobData: FindShipperJobData = {
        pendingAssignmentId: assignment.id,
        orderId: assignment.orderId,
        attempt: assignment.attemptCount + 1,
      };

      return this.queueService.addJob(QueueNames.FIND_SHIPPER, jobData, {
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

  private async findNearestAvailableShipper(order: Order): Promise<ActiveShipper | null> {
    if (!order.restaurant?.latitude || !order.restaurant?.longitude || !activeShipperTracker) {
      return null;
    }

    const restaurantLat = Number(order.restaurant.latitude);
    const restaurantLng = Number(order.restaurant.longitude);
    const alreadyNotified = await this.store.getNotifiedShippers(order.id);
    let nearestShipper: ActiveShipper | null = null;
    let shortestDistance = Infinity;

    for (const shipper of activeShipperTracker.getAllShippers()) {
      if (alreadyNotified.includes(shipper.shipperId)) {
        continue;
      }

      const distance = haversineDistance(shipper.latitude, shipper.longitude, restaurantLat, restaurantLng);
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

  private async scheduleRetryForAssignment(assignment: PendingAssignmentState, baseDelayMinutes = 1): Promise<void> {
    const maxRetries = DELIVERY_ASSIGNMENT_POLICY.retryMaxAttempts;
    if (assignment.attemptCount >= maxRetries) {
      await this.store.remove(assignment);
      return;
    }

    const delayMinutes = baseDelayMinutes === 0
      ? 0
      : Math.min(baseDelayMinutes * Math.pow(2, assignment.attemptCount), 60);

    assignment.attemptCount += 1;
    assignment.lastAttemptAt = new Date().toISOString();
    assignment.nextAttemptAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
    await this.store.save(assignment);
  }

  private async validateOrderForAssignment(orderId: string): Promise<Order> {
    const order = await this.findOrderForAssignment(orderId);

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.status !== 'confirmed') {
      throw new Error(`Order ${orderId} is not confirmed (status: ${order.status})`);
    }

    if (order.shippingDetail) {
      throw new Error(`Order ${orderId} is already assigned to a shipper`);
    }

    return order;
  }

  private async findOrderForAssignment(orderId: string): Promise<Order | null> {
    return this.orderRepository.findOne({
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
  }

  private async handleShipperResponseTimeout(assignmentId: string, shipperId: string): Promise<void> {
    const assignment = await this.store.getById(assignmentId);
    if (!assignment || assignment.targetShipperId !== shipperId) {
      return;
    }

    const order = await this.orderRepository.findOne({
      where: { id: assignment.orderId },
      relations: ['shippingDetail'],
    });

    if (!order || order.status !== 'confirmed' || order.shippingDetail) {
      await this.store.remove(assignment);
      return;
    }

    await this.store.clearHoldForShipper(shipperId);
    assignment.isSentToShipper = false;
    assignment.targetShipperId = null;
    await this.scheduleRetryForAssignment(assignment);
  }

  private isValidJobData(data: unknown): data is FindShipperJobData {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const job = data as Partial<FindShipperJobData>;
    return (
      typeof job.pendingAssignmentId === 'string' &&
      typeof job.orderId === 'string' &&
      typeof job.attempt === 'number'
    );
  }
}
