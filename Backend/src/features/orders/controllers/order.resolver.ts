import { Logger } from '@nestjs/common';
import { Args, Context, Query, Resolver, Subscription } from '@nestjs/graphql';
import { Order } from 'src/entities/order.entity';
import { ActiveShipperTrackerService } from 'src/features/delivery/public-api';
import { pubSub } from 'src/pubsub';

interface OrderCreatedPayload {
  orderCreated: Order;
}
interface OrderStatusUpdatedPayload {
  orderStatusUpdated: Order;
}
interface ShipperOrderPayload {
  orderConfirmedForShippers: Order;
  targetShipperId: string;
  distanceKm?: number;
  priorityScore?: number;
}

/** GraphQL transport for Order events; shipper runtime policy is Delivery-owned. */
@Resolver(() => Order)
export class OrderResolver {
  private readonly logger = new Logger(OrderResolver.name);

  constructor(private readonly activeShipperTracker: ActiveShipperTrackerService) {}

  @Subscription(() => Order, {
    filter: (payload: OrderCreatedPayload, variables: { restaurantId: string }) =>
      payload.orderCreated.restaurant?.id === variables.restaurantId &&
      payload.orderCreated.status === 'pending',
    resolve: (payload: OrderCreatedPayload) => payload.orderCreated,
  })
  orderCreated(@Args('restaurantId') restaurantId: string, @Context() _context: unknown) {
    if (!restaurantId) throw new Error('restaurantId is required for orderCreated subscription');
    return pubSub.asyncIterableIterator('orderCreated');
  }

  @Subscription(() => Order, {
    filter: (payload: OrderStatusUpdatedPayload, variables: { userId: string }) =>
      payload.orderStatusUpdated.user?.id === variables.userId &&
      ['confirmed', 'delivering', 'shipper_received', 'completed', 'canceled'].includes(
        payload.orderStatusUpdated.status,
      ),
    resolve: (payload: OrderStatusUpdatedPayload) => payload.orderStatusUpdated,
  })
  orderStatusUpdated(@Args('userId') userId: string, @Context() _context: unknown) {
    if (!userId) throw new Error('userId is required for orderStatusUpdated subscription');
    return pubSub.asyncIterableIterator('orderStatusUpdated');
  }

  @Subscription(() => Order, {
    filter: (payload: ShipperOrderPayload, variables: { shipperId: string }) =>
      payload.orderConfirmedForShippers.status === 'confirmed' &&
      !payload.orderConfirmedForShippers.shippingDetail &&
      payload.targetShipperId === variables.shipperId,
    resolve: (payload: ShipperOrderPayload) => {
      const order = payload.orderConfirmedForShippers;
      const shippingFee = order.shippingFee || 0;
      const shipperEarnings =
        order.shipperEarnings || Math.round(shippingFee * (order.shipperCommissionRate || 0.8));
      return {
        ...order,
        shipperEarnings,
        deliveryMetadata: {
          distanceKm: order.deliveryDistance || payload.distanceKm || 0,
          priorityScore: payload.priorityScore,
          assignedAt: new Date(),
          shippingInfo: {
            totalDistance: order.deliveryDistance || payload.distanceKm || 0,
            shippingFee,
            shipperEarnings,
            platformFee: shippingFee - shipperEarnings,
            shipperCommissionRate: order.shipperCommissionRate || 0.8,
            estimatedDeliveryTime: order.estimatedDeliveryTime || 30,
          },
        },
      };
    },
  })
  async orderConfirmedForShippers(
    @Args('shipperId') shipperId: string,
    @Args('latitude') latitude: string,
    @Args('longitude') longitude: string,
    @Args('maxDistance', { nullable: true, defaultValue: 20 }) maxDistance: number,
    @Context() _context: unknown,
  ) {
    if (!shipperId || !latitude || !longitude) {
      throw new Error('Shipper ID, latitude and longitude are required');
    }
    const result = await this.activeShipperTracker.addShipper(
      shipperId,
      Number(latitude),
      Number(longitude),
      maxDistance,
    );
    if (!result.success) {
      this.logger.warn(`Shipper ${shipperId} subscription rejected: ${result.message}`);
      throw new Error(`Subscription rejected: ${result.message}`);
    }
    return pubSub.asyncIterableIterator('orderConfirmedForShippers');
  }

  @Query(() => String)
  getShipperStats() {
    return JSON.stringify(this.activeShipperTracker.getShipperStats(), null, 2);
  }

  @Query(() => String)
  async findBestShipperForLocation(
    @Args('latitude') latitude: number,
    @Args('longitude') longitude: number,
    @Args('orderValue', { nullable: true, defaultValue: 0 }) orderValue: number,
    @Args('urgency', { nullable: true, defaultValue: 'medium' }) urgency: string,
  ) {
    const result = await this.activeShipperTracker.findBestShipperForOrder(
      latitude,
      longitude,
      orderValue,
      urgency === 'high' || urgency === 'low' ? urgency : 'medium',
    );
    return JSON.stringify(result);
  }

  @Query(() => String)
  getShipperQueueStatus(@Args('orderId') orderId: string) {
    return JSON.stringify({ orderId, ...this.activeShipperTracker.getShipperStats() });
  }

  @Query(() => String)
  triggerShipperCleanup() {
    this.activeShipperTracker.cleanup();
    return 'Cleanup completed';
  }

  @Query(() => String)
  orderHello() {
    return 'Order resolver is working with Delivery-owned shipper tracking!';
  }
}
