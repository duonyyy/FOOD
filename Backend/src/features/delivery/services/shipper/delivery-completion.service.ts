import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DELIVERY_COMPLETED_EVENT,
  type DeliveryCompletedEvent,
} from 'src/common/events/delivery-completed.event';
import { OutboxService } from 'src/common/events/outbox.service';
import { ShipperProfile } from 'src/entities/shipperProfile.entity';
import { ShippingDetail, ShippingStatus } from 'src/entities/shippingDetail.entity';
import {
  OrderDeliveryCompletionReaderService,
  type DeliveryCompletionOrder,
} from 'src/features/orders/order-delivery-completion-reader.public-api';
import { Repository } from 'typeorm';

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

/**
 * Delivery owns settlement of its trip and emits a durable completion event.
 * Orders remains the only owner that changes the Order lifecycle to completed.
 */
@Injectable()
export class DeliveryCompletionService {
  private readonly logger = new Logger(DeliveryCompletionService.name);

  constructor(
    @InjectRepository(ShippingDetail)
    private readonly shippingDetailRepository: Repository<ShippingDetail>,
    @InjectRepository(ShipperProfile)
    private readonly shipperProfileRepository: Repository<ShipperProfile>,
    private readonly orderCompletionReader: OrderDeliveryCompletionReaderService,
    private readonly outboxService: OutboxService,
  ) {}

  async complete(orderId: string, shipperId: string): Promise<CompletionResponse> {
    const completion = await this.shippingDetailRepository.manager.transaction(async (manager) => {
      const shippingDetailRepository = manager.getRepository(ShippingDetail);
      const shipperProfileRepository = manager.getRepository(ShipperProfile);
      const shippingDetail = await shippingDetailRepository.findOne({
        where: { order: { id: orderId } },
        relations: ['shipper'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!shippingDetail) {
        throw new NotFoundException('Không tìm thấy thông tin vận chuyển');
      }
      if (shippingDetail.shipper?.id !== shipperId) {
        throw new ForbiddenException('You are not assigned to this order');
      }

      const order = await this.orderCompletionReader.findForCompletion(orderId);
      if (!order) {
        throw new NotFoundException('Đơn hàng không tồn tại');
      }
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

      const shipperProfile = await shipperProfileRepository.findOne({
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

      await shippingDetailRepository.save(shippingDetail);
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
}
