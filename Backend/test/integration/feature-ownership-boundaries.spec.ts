import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('feature ownership boundaries', () => {
  it('keeps Messenger persistence limited to its own Conversation and Message entities', () => {
    const module = source('src/features/communications/messenger/messenger.module.ts');
    const service = source('src/features/communications/messenger/messenger.service.ts');

    expect(module).toContain('TypeOrmModule.forFeature([Conversation, Message])');
    expect(module).not.toMatch(/\b(User|Order|Restaurant|ShippingDetail)\b.*forFeature/);
    expect(service).not.toMatch(/@InjectRepository\((User|Order|Restaurant|ShippingDetail)\)/);
    expect(service).toContain('OrderService');
    expect(service).not.toContain('OrderMessagingReaderService');
    expect(service).toContain('RestaurantReaderService');
    expect(service).toContain('IdentityUserQueryService');
  });

  it('keeps shipper administration in Delivery while retaining the legacy route', () => {
    const usersModule = source('src/features/users/users.module.ts');
    const usersService = source('src/features/users/services/users.service.ts');
    const usersController = source('src/features/users/controllers/users.controller.ts');
    const deliveryController = source(
      'src/features/delivery/controllers/legacy-shipper-admin.controller.ts',
    );

    expect(usersModule).not.toContain('ShipperProfileModule');
    expect(usersService).not.toContain('SHIPPER_PROFILE_');
    expect(usersController).not.toContain("@Get('shippers')");
    expect(deliveryController).toContain("@Controller('users')");
    expect(deliveryController).toContain("@Get('shippers')");
  });

  it('limits Orders and Promotions TypeORM registrations to their owned entities', () => {
    const ordersModule = source('src/features/orders/orders.module.ts');
    const promotionsModule = source('src/features/promotions/promotions.module.ts');

    expect(ordersModule).toContain('TypeOrmModule.forFeature([Order, OrderDetail])');
    expect(ordersModule).not.toMatch(
      /\b(Food|Topping|Address|Restaurant|Promotion|Checkout|Review|ShippingDetail|User)\b/,
    );
    expect(promotionsModule).toContain(
      'TypeOrmModule.forFeature([Promotion, PromotionRedemption])',
    );
    expect(promotionsModule).not.toMatch(/forFeature\(\[[^\]]*\b(Food|Order)\b/);
  });

  it('keeps Delivery dispatch on the narrow Orders API instead of the Order repository', () => {
    const deliveryModule = source('src/features/delivery/delivery.module.ts');
    const dispatch = source('src/features/delivery/services/dispatch/delivery-dispatch.service.ts');
    const integration = source(
      'src/features/delivery/services/integration/delivery-integration.service.ts',
    );

    expect(deliveryModule).not.toContain('entities/order.entity');
    expect(deliveryModule).not.toContain('      Order,');
    expect(dispatch).toContain('order-delivery-dispatch-reader.public-api');
    expect(dispatch).not.toContain('DeliveryIntegrationService');
    expect(integration).not.toContain('entities/order.entity');
    expect(integration).not.toContain('findOrderForDeliveryAssignment');
  });

  it('keeps active shipper subscription behavior inside Delivery', () => {
    const orderResolver = source('src/features/orders/controllers/order.resolver.ts');
    const shipperResolver = source('src/features/delivery/controllers/shipper.resolver.ts');

    expect(orderResolver).not.toContain('ActiveShipperTrackerService');
    expect(orderResolver).not.toContain('orderConfirmedForShippers(');
    expect(shipperResolver).toContain('ActiveShipperTrackerService');
    expect(shipperResolver).toContain('orderConfirmedForShippers(');
    expect(shipperResolver).toContain('order-delivery-shipper.public-api');
    expect(shipperResolver).not.toContain('entities/order.entity');
  });

  it('keeps pending assignment orchestration out of Orders', () => {
    const ordersModule = source('src/features/orders/orders.module.ts');

    expect(ordersModule).not.toContain('DeliveryModule');
    expect(ordersModule).not.toContain('src/features/delivery');

    for (const ordersFile of [
      'src/features/orders/controllers/merchant-orders.controller.ts',
      'src/features/orders/services/merchant-orders.service.ts',
      'src/features/orders/services/admin-orders.service.ts',
    ]) {
      expect(source(ordersFile)).not.toContain('src/features/delivery');
      expect(source(ordersFile)).not.toContain('DeliveryDispatchService');
    }

    const deliveryHandler = source(
      'src/features/delivery/services/dispatch/order-status-delivery.handler.ts',
    );
    expect(deliveryHandler).toContain('ORDER_STATUS_CHANGED_EVENT');
    expect(deliveryHandler).toContain('addPendingAssignment');
    expect(deliveryHandler).toContain('removePendingAssignment');
  });

  it('keeps Delivery completion on a narrow Orders reader contract', () => {
    const completion = source(
      'src/features/delivery/services/shipper/delivery-completion.service.ts',
    );

    expect(completion).toContain('order-delivery-completion-reader.public-api');
    expect(completion).not.toContain('entities/order.entity');
    expect(completion).not.toContain('orderRepository');
  });

  it('keeps Analytics on a narrow Orders reader contract', () => {
    const analyticsModule = source('src/features/analytics/analytics.module.ts');

    expect(analyticsModule).toContain('order-analytics-reader.public-api');
    expect(analyticsModule).toContain('OrderAnalyticsReaderModule');
    expect(analyticsModule).not.toContain('OrdersModule');

    for (const analyticsConsumer of [
      'src/features/analytics/services/analytics-projection.service.ts',
      'src/features/analytics/services/analytics-reconciliation.service.ts',
    ]) {
      expect(source(analyticsConsumer)).toContain('order-analytics-reader.public-api');
      expect(source(analyticsConsumer)).not.toContain('src/features/orders/public-api');
    }
  });

  it('keeps Notifications independent from Orders runtime providers', () => {
    const notificationsModule = source('src/features/notifications/notifications.module.ts');
    const notificationHandler = source(
      'src/features/notifications/handlers/notification-event.handler.ts',
    );

    expect(notificationsModule).not.toContain('OrdersModule');
    expect(notificationsModule).not.toContain('src/features/orders');
    expect(notificationHandler).not.toContain('OrderNotificationReaderAdapter');
    expect(notificationHandler).not.toContain('src/features/orders');
    expect(notificationHandler).toContain('event.customerId');
  });

  it('keeps Delivery assignment state changes out of the legacy Order transaction', () => {
    const shipperDelivery = source(
      'src/features/delivery/services/shipper/shipper-delivery.service.ts',
    );
    const assignmentSaga = source(
      'src/features/delivery/services/shipper/delivery-assignment-saga.service.ts',
    );
    const assignmentMethod = shipperDelivery.match(
      /async assignOrderToShipper[\s\S]*?(?=\n\s{2}async getOrder)/,
    )?.[0];

    expect(assignmentMethod).toContain('deliveryAssignmentSagaService.assign');
    expect(assignmentMethod).not.toContain('orderRepository');
    expect(assignmentSaga).not.toContain('entities/order.entity');
    expect(assignmentSaga).toContain('DELIVERY_ASSIGNMENT_REQUESTED_EVENT');
  });

  it('routes shipper reads and lifecycle changes through narrow Orders APIs', () => {
    const shipperDelivery = source(
      'src/features/delivery/services/shipper/shipper-delivery.service.ts',
    );

    expect(shipperDelivery).toContain('order-delivery-shipper.public-api');
    expect(shipperDelivery).toContain('orderLifecycleCommand.startDelivery');
    expect(shipperDelivery).toContain('orderLifecycleCommand.cancelDelivery');
    expect(shipperDelivery).toContain('orderShipperReader.getShipperOrder');
    expect(shipperDelivery).not.toContain('entities/order.entity');
    expect(shipperDelivery).not.toContain('orderRepository');
    expect(shipperDelivery).not.toContain('orderReassignedToShippers');
  });

  it('uses concrete infrastructure services through public APIs', () => {
    const customerOrders = source('src/features/orders/services/customer-orders.service.ts');
    const adminOrders = source('src/features/orders/services/admin-orders.service.ts');
    const merchantOrders = source('src/features/orders/services/merchant-orders.service.ts');
    const publicPromotionsService = source(
      'src/features/promotions/services/public-promotions.service.ts',
    );
    const adminPromotionsService = source(
      'src/features/promotions/services/admin-promotions.service.ts',
    );

    expect(customerOrders).toContain('MapboxService');
    expect(customerOrders).toContain('src/infra/mapbox/public-api');
    expect(customerOrders).not.toContain('src/infra/mapbox/mapbox.service');
    expect(adminOrders).not.toContain('src/infra/queue/queue.service');
    expect(merchantOrders).not.toContain('src/infra/queue/queue.service');
    expect(adminPromotionsService).toContain('StorageService');
    expect(adminPromotionsService).toContain('AppCacheService');
    expect(adminPromotionsService).toContain('src/infra/minio/public-api');
    expect(adminPromotionsService).not.toContain('src/infra/minio/storage.service');
    expect(adminPromotionsService).toContain('src/infra/cache/public-api');
    expect(adminPromotionsService).not.toContain('src/infra/cache/cache.service');
    expect(publicPromotionsService).toContain('AppCacheService');
    expect(publicPromotionsService).toContain('src/infra/cache/public-api');
  });
});
