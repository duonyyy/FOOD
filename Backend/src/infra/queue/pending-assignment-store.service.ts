import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { DELIVERY_ASSIGNMENT_POLICY } from 'src/features/delivery/contracts/delivery-assignment.policy';
import { REDIS_CLIENT } from 'src/infra/cache/cache.constants';

export interface PendingAssignmentState {
  id: string;
  orderId: string;
  priority: number;
  attemptCount: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string;
  createdAt: string;
  notes: string | null;
  isSentToShipper: boolean;
  targetShipperId: string | null;
}

export interface ShipperAssignmentHold {
  assignmentId: string;
  orderId: string;
  shipperId: string;
  expiresAt: string;
}

@Injectable()
export class PendingAssignmentStore {
  private readonly logger = new Logger(PendingAssignmentStore.name);
  private readonly pendingTtlSeconds = DELIVERY_ASSIGNMENT_POLICY.pendingAssignmentTtlSeconds;
  private readonly shipperHoldTtlSeconds = DELIVERY_ASSIGNMENT_POLICY.offerHoldTtlSeconds;
  private readonly dueSetKey = 'pending-assignments:due';

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async createOrGet(orderId: string, priority: number): Promise<PendingAssignmentState> {
    const existingId = await this.redis.get(this.orderKey(orderId));
    if (existingId) {
      const existing = await this.getById(existingId);
      if (existing) {
        return existing;
      }

      await this.redis.del(this.orderKey(orderId));
    }

    const now = new Date();
    const assignment: PendingAssignmentState = {
      id: this.createAssignmentId(orderId),
      orderId,
      priority,
      attemptCount: 0,
      lastAttemptAt: null,
      nextAttemptAt: now.toISOString(),
      createdAt: now.toISOString(),
      notes: null,
      isSentToShipper: false,
      targetShipperId: null,
    };

    const claimed = await this.redis.set(this.orderKey(orderId), assignment.id, 'EX', this.pendingTtlSeconds, 'NX');
    if (claimed !== 'OK') {
      const claimedId = await this.redis.get(this.orderKey(orderId));
      const claimedAssignment = claimedId ? await this.getById(claimedId) : null;
      if (claimedAssignment) {
        return claimedAssignment;
      }
    }

    await this.save(assignment);
    return assignment;
  }

  async save(assignment: PendingAssignmentState): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.set(this.assignmentKey(assignment.id), JSON.stringify(assignment), 'EX', this.pendingTtlSeconds);
    pipeline.set(this.orderKey(assignment.orderId), assignment.id, 'EX', this.pendingTtlSeconds);
    pipeline.zadd(this.dueSetKey, String(new Date(assignment.nextAttemptAt).getTime()), assignment.id);
    pipeline.expire(this.notifiedKey(assignment.orderId), this.pendingTtlSeconds);
    await pipeline.exec();
  }

  async getById(assignmentId: string): Promise<PendingAssignmentState | null> {
    const value = await this.redis.get(this.assignmentKey(assignmentId));
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as PendingAssignmentState;
    } catch (error) {
      this.logger.warn(`Failed to parse pending assignment ${assignmentId}: ${(error as Error).message}`);
      return null;
    }
  }

  async getByOrderId(orderId: string): Promise<PendingAssignmentState | null> {
    const assignmentId = await this.redis.get(this.orderKey(orderId));
    return assignmentId ? this.getById(assignmentId) : null;
  }

  async getDueAssignments(limit: number): Promise<PendingAssignmentState[]> {
    const now = Date.now();
    const ids = await this.redis.zrangebyscore(this.dueSetKey, '-inf', now, 'LIMIT', 0, limit);
    const assignments = await Promise.all(ids.map((id) => this.getById(id)));
    return assignments.filter((assignment): assignment is PendingAssignmentState => Boolean(assignment));
  }

  async acquireProcessingLock(assignmentId: string, ttlSeconds = 30): Promise<boolean> {
    const result = await this.redis.set(this.lockKey(assignmentId), '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async removeDue(assignmentId: string): Promise<void> {
    await this.redis.zrem(this.dueSetKey, assignmentId);
  }

  async remove(assignment: PendingAssignmentState): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.del(this.assignmentKey(assignment.id));
    pipeline.del(this.orderKey(assignment.orderId));
    pipeline.del(this.orderHoldKey(assignment.orderId));
    pipeline.del(this.notifiedKey(assignment.orderId));
    pipeline.del(this.shipperHoldKey(assignment.targetShipperId ?? ''));
    pipeline.zrem(this.dueSetKey, assignment.id);
    pipeline.del(this.lockKey(assignment.id));
    await pipeline.exec();
  }

  async removeByOrderId(orderId: string): Promise<boolean> {
    const assignment = await this.getByOrderId(orderId);
    if (!assignment) {
      return false;
    }

    await this.remove(assignment);
    return true;
  }

  async getExpiredAssignments(cutoffDate: Date): Promise<PendingAssignmentState[]> {
    const cutoffMs = cutoffDate.getTime();
    const ids = await this.redis.zrange(this.dueSetKey, 0, -1);
    const assignments = await Promise.all(ids.map((id) => this.getById(id)));

    return assignments
      .filter((assignment): assignment is PendingAssignmentState => Boolean(assignment))
      .filter((assignment) => new Date(assignment.createdAt).getTime() < cutoffMs);
  }

  async count(): Promise<number> {
    return this.redis.zcard(this.dueSetKey);
  }

  async countReady(): Promise<number> {
    return this.redis.zcount(this.dueSetKey, '-inf', Date.now());
  }

  async markShipperNotified(assignment: PendingAssignmentState, shipperId: string): Promise<void> {
    const expiresAt = new Date(Date.now() + this.shipperHoldTtlSeconds * 1000).toISOString();
    const hold: ShipperAssignmentHold = {
      assignmentId: assignment.id,
      orderId: assignment.orderId,
      shipperId,
      expiresAt,
    };

    const pipeline = this.redis.pipeline();
    pipeline.sadd(this.notifiedKey(assignment.orderId), shipperId);
    pipeline.expire(this.notifiedKey(assignment.orderId), this.pendingTtlSeconds);
    pipeline.set(this.shipperHoldKey(shipperId), JSON.stringify(hold), 'EX', this.shipperHoldTtlSeconds);
    pipeline.set(this.orderHoldKey(assignment.orderId), JSON.stringify(hold), 'EX', this.shipperHoldTtlSeconds);
    await pipeline.exec();
  }

  async addNotifiedShipper(orderId: string, shipperId: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.sadd(this.notifiedKey(orderId), shipperId);
    pipeline.expire(this.notifiedKey(orderId), this.pendingTtlSeconds);
    await pipeline.exec();
  }

  async getNotifiedShippers(orderId: string): Promise<string[]> {
    return this.redis.smembers(this.notifiedKey(orderId));
  }

  async hasNotifiedShipper(orderId: string, shipperId: string): Promise<boolean> {
    const result = await this.redis.sismember(this.notifiedKey(orderId), shipperId);
    return result === 1;
  }

  async getHoldForShipper(shipperId: string): Promise<ShipperAssignmentHold | null> {
    const value = await this.redis.get(this.shipperHoldKey(shipperId));
    return value ? (JSON.parse(value) as ShipperAssignmentHold) : null;
  }

  async getHoldForOrder(orderId: string): Promise<ShipperAssignmentHold | null> {
    const value = await this.redis.get(this.orderHoldKey(orderId));
    return value ? (JSON.parse(value) as ShipperAssignmentHold) : null;
  }

  async clearHoldForShipper(shipperId: string): Promise<void> {
    const hold = await this.getHoldForShipper(shipperId);
    const pipeline = this.redis.pipeline();
    pipeline.del(this.shipperHoldKey(shipperId));
    if (hold) {
      pipeline.del(this.orderHoldKey(hold.orderId));
    }
    await pipeline.exec();
  }

  async getExcludedShipperIds(orderId: string): Promise<string[]> {
    return this.getNotifiedShippers(orderId);
  }

  private createAssignmentId(orderId: string): string {
    return `${orderId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private assignmentKey(assignmentId: string): string {
    return `pending-assignment:${assignmentId}`;
  }

  private orderKey(orderId: string): string {
    return `pending-assignment:order:${orderId}`;
  }

  private notifiedKey(orderId: string): string {
    return `pending-assignment:notified:${orderId}`;
  }

  private shipperHoldKey(shipperId: string): string {
    return `pending-assignment:shipper:${shipperId}`;
  }

  private orderHoldKey(orderId: string): string {
    return `pending-assignment:order-hold:${orderId}`;
  }

  private lockKey(assignmentId: string): string {
    return `pending-assignment:lock:${assignmentId}`;
  }
}
