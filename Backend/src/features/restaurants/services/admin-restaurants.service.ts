import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import {
  RESTAURANT_APPROVAL_DECIDED_EVENT,
  type RestaurantApprovalDecidedEvent,
} from 'src/common/events/restaurant-approval-decided.event';
import { estimateDeliveryTime, haversineDistance } from 'src/common/utils/geo.util';
import { Restaurant, RestaurantStatus } from 'src/entities/restaurant.entity';
import {
  RestaurantApprovalAction,
  RestaurantApprovalAudit,
} from 'src/entities/restaurantApprovalAudit.entity';
import { AppCacheService } from 'src/infra/cache/public-api';
import { StorageService } from 'src/infra/minio/public-api';
import { Repository } from 'typeorm';
import { ApproveRestaurantDto, RejectRestaurantDto } from '../dto/restaurant-approval.dto';

type RestaurantWithDistance = Restaurant & { distance: number | null; deliveryTime: number | null };

@Injectable()
export class AdminRestaurantsService {
  private readonly logger = new Logger(AdminRestaurantsService.name);

  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
    private readonly cache: AppCacheService,
    private readonly eventBus: InProcessEventBus,
    private readonly storage: StorageService,
  ) {}

  async getRestaurantRequests(page = 1, pageSize = 10, lat?: number, lng?: number) {
    const [items, totalItems] = await this.restaurantRepository.findAndCount({
      where: { status: RestaurantStatus.PENDING },
      relations: ['owner'],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      items: items.map((item) => this.withDistance(item, lat, lng)),
      totalItems,
      page,
      pageSize,
      totalPages: Math.ceil(totalItems / pageSize),
    };
  }

  async getCertificateDownloadUrl(id: string): Promise<string> {
    const restaurant = await this.findOne(id);
    if (!restaurant.certificateImage) {
      throw new NotFoundException('Restaurant certificate not found');
    }
    return this.storage.getSignedPrivateUrl(restaurant.certificateImage);
  }

  async deleteRestaurantRequest(id: string): Promise<void> {
    const restaurant = await this.findOne(id);
    if (restaurant.status !== RestaurantStatus.PENDING) {
      throw new BadRequestException('Only a pending restaurant request can be deleted');
    }
    await this.restaurantRepository.remove(restaurant);
    await Promise.all([
      this.cache.deleteByPattern('restaurant:*'),
      this.cache.deleteByPattern(`restaurant:${id}:*`),
      restaurant.owner?.id
        ? this.cache.deleteByPattern(`restaurant:owner:${restaurant.owner.id}:*`)
        : Promise.resolve(0),
    ]);
  }

  private async findOne(id: string): Promise<Restaurant> {
    const restaurant = await this.restaurantRepository.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    return restaurant;
  }

  private withDistance(restaurant: Restaurant, lat?: number, lng?: number): RestaurantWithDistance {
    const restaurantLat = restaurant.latitude ?? restaurant.address?.latitude;
    const restaurantLng = restaurant.longitude ?? restaurant.address?.longitude;
    const distance =
      lat !== undefined && lng !== undefined && restaurantLat != null && restaurantLng != null
        ? haversineDistance(lat, lng, Number(restaurantLat), Number(restaurantLng))
        : null;
    return {
      ...restaurant,
      distance,
      deliveryTime: distance === null ? null : estimateDeliveryTime(distance),
    };
  }

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
      this.cache.deleteByPattern('food:*'),
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
