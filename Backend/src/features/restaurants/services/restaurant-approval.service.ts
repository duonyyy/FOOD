import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import {
  RESTAURANT_APPROVAL_DECIDED_EVENT,
  type RestaurantApprovalDecidedEvent,
} from 'src/common/events/restaurant-approval-decided.event';
import { Restaurant, RestaurantStatus } from 'src/entities/restaurant.entity';
import {
  RestaurantApprovalAction,
  RestaurantApprovalAudit,
} from 'src/entities/restaurantApprovalAudit.entity';
import { CACHE_PORT, type CachePort } from 'src/infra/contracts/cache.port';
import { Repository } from 'typeorm';
import { ApproveRestaurantDto, RejectRestaurantDto } from '../dto/restaurant-approval.dto';

@Injectable()
export class RestaurantApprovalService {
  private readonly logger = new Logger(RestaurantApprovalService.name);

  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
    @InjectRepository(RestaurantApprovalAudit)
    private readonly approvalAuditRepository: Repository<RestaurantApprovalAudit>,
    @Inject(CACHE_PORT)
    private readonly cache: CachePort,
    private readonly eventBus: InProcessEventBus,
  ) {}

  async approveRestaurant(
    restaurantId: string,
    actorUserId: string,
    input: ApproveRestaurantDto,
  ): Promise<Restaurant> {
    return this.decide(restaurantId, actorUserId, RestaurantApprovalAction.APPROVED, input.note);
  }

  async rejectRestaurant(
    restaurantId: string,
    actorUserId: string,
    input: RejectRestaurantDto,
  ): Promise<Restaurant> {
    return this.decide(restaurantId, actorUserId, RestaurantApprovalAction.REJECTED, input.reason);
  }

  private async decide(
    restaurantId: string,
    actorUserId: string,
    action: RestaurantApprovalAction,
    reason?: string,
  ): Promise<Restaurant> {
    const decision = await this.restaurantRepository.manager.transaction(async (manager) => {
      const restaurant = await manager.getRepository(Restaurant).findOne({
        where: { id: restaurantId },
        relations: ['owner'],
      });
      if (!restaurant) {
        throw new NotFoundException('Restaurant not found');
      }
      if (restaurant.status !== RestaurantStatus.PENDING) {
        throw new ConflictException(
          'Only a pending restaurant request can be approved or rejected',
        );
      }

      const previousStatus = restaurant.status;
      restaurant.status =
        action === RestaurantApprovalAction.APPROVED
          ? RestaurantStatus.APPROVED
          : RestaurantStatus.REJECTED;
      const savedRestaurant = await manager.getRepository(Restaurant).save(restaurant);
      const audit = await manager.getRepository(RestaurantApprovalAudit).save(
        manager.getRepository(RestaurantApprovalAudit).create({
          restaurantId: savedRestaurant.id,
          actorUserId,
          action,
          reason: reason?.trim() || null,
          previousStatus,
          nextStatus: savedRestaurant.status,
        }),
      );

      return { restaurant: savedRestaurant, audit };
    });

    await this.clearRestaurantCache(decision.restaurant.id, decision.restaurant.owner?.id);
    await this.publishAuditEvent(decision.audit);
    return decision.restaurant;
  }

  private async clearRestaurantCache(restaurantId: string, ownerId?: string): Promise<void> {
    await Promise.all([
      this.cache.deleteByPattern('restaurant:*'),
      this.cache.deleteByPattern(`restaurant:${restaurantId}:*`),
      ownerId ? this.cache.deleteByPattern(`restaurant:owner:${ownerId}:*`) : Promise.resolve(0),
    ]);
  }

  private async publishAuditEvent(audit: RestaurantApprovalAudit): Promise<void> {
    const event: RestaurantApprovalDecidedEvent = {
      auditId: audit.id,
      restaurantId: audit.restaurantId,
      actorUserId: audit.actorUserId,
      action: audit.action,
      reason: audit.reason,
      previousStatus: audit.previousStatus as RestaurantStatus,
      nextStatus: audit.nextStatus as RestaurantStatus,
      occurredAt: audit.createdAt,
    };

    try {
      await this.eventBus.publish(RESTAURANT_APPROVAL_DECIDED_EVENT, event);
    } catch (error) {
      this.logger.error(
        `Restaurant approval event failed for audit=${audit.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
