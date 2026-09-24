import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function typescriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? typescriptFiles(path) : entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('feature ownership boundaries', () => {
  it('keeps the two Delivery modules and their narrow public APIs', () => {
    const deliveryRoot = resolve(process.cwd(), 'src/features/delivery');
    const topLevel = readdirSync(deliveryRoot);
    const profileModule = source('src/features/delivery/shipper-profile.module.ts');
    const authModule = source('src/features/auth/auth.module.ts');
    const deliveryModule = source('src/features/delivery/delivery.module.ts');
    const publicApi = source('src/features/delivery/public-api.ts');

    expect(topLevel.filter((name) => name.endsWith('.module.ts')).sort()).toEqual([
      'delivery.module.ts',
      'shipper-profile.module.ts',
    ]);
    expect(topLevel.filter((name) => name.endsWith('public-api.ts')).sort()).toEqual([
      'public-api.ts',
      'shipper-profile.public-api.ts',
    ]);
    expect(authModule).toContain('ShipperProfileModule');
    expect(authModule).not.toContain('DeliveryModule');
    expect(profileModule).not.toContain('AuthModule');
    expect(deliveryModule).toContain('AuthModule');
    expect(publicApi).not.toMatch(/Controller|ShipperProfileService|Repository|Entity/);
  });

  it('keeps six main Delivery services and two explicit support services', () => {
    const root = resolve(process.cwd(), 'src/features/delivery/services');
    const mainServices = readdirSync(root)
      .filter((name) => name.endsWith('.service.ts'))
      .sort();
    expect(mainServices).toEqual(
      [
        'admin-delivery.service.ts',
        'customer-delivery.service.ts',
        'delivery-dispatch.service.ts',
        'delivery-report.service.ts',
        'delivery-trip.service.ts',
        'shipper-delivery.service.ts',
      ].sort(),
    );
    expect(
      typescriptFiles(root)
        .filter((file) => file.endsWith('.service.ts'))
        .map((file) => relative(root, file).replaceAll('\\', '/'))
        .sort(),
    ).toEqual(
      [
        ...mainServices,
        'dispatch/active-shipper-tracker.service.ts',
        'shipper/shipper-profile.service.ts',
      ].sort(),
    );
    const module = source('src/features/delivery/delivery.module.ts');
    expect(module).toContain('DeliveryTripService');
    expect(module).not.toMatch(/DeliveryAssignmentSagaService|DeliveryCompletionService|DeliveryEarningsService/);
  });

  it('keeps persisted Order and Delivery entities in their owner features', () => {
    const featureRoot = resolve(process.cwd(), 'src/features');
    const deliveryEntities =
      /(?:shippingDetail|shipperProfile|pendingShipperAssignment|shipperCertificateInfo|deliveryEarningsEvent)\.entity/;
    const orderEntity = /(?:^|\/)order\.entity$/;
    const violations = typescriptFiles(featureRoot).flatMap((file) => {
      const path = relative(featureRoot, file).replaceAll('\\', '/');
      const owner = path.split('/')[0];
      const text = readFileSync(file, 'utf8');
      const imports = [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
      return imports.flatMap((importPath) => {
        if (owner !== 'delivery' && deliveryEntities.test(importPath)) return [path];
        if (owner !== 'orders' && orderEntity.test(importPath.replaceAll('\\', '/')))
          return [path];
        return [];
      });
    });

    expect(violations).toEqual([]);
  });

  it('prevents Delivery from writing persisted Order state directly', () => {
    const deliveryRoot = resolve(process.cwd(), 'src/features/delivery');
    const violations = typescriptFiles(deliveryRoot).flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return /(?:InjectRepository|getRepository)\s*\(\s*Order\s*\)|\b(?:order|existingOrder)\.status\s*=|\bUPDATE\s+"?orders"?\s+SET\b/i.test(
        text,
      )
        ? [relative(deliveryRoot, file).replaceAll('\\', '/')]
        : [];
    });
    expect(violations).toEqual([]);
  });

  it('keeps Orders on one module, one public API and the approved service list', () => {
    const ordersRoot = resolve(process.cwd(), 'src/features/orders');
    const topLevel = readdirSync(ordersRoot);
    const services = readdirSync(resolve(ordersRoot, 'services'))
      .filter((name) => name.endsWith('.ts'))
      .sort();

    expect(topLevel.filter((name) => name.endsWith('.module.ts'))).toEqual(['orders.module.ts']);
    expect(topLevel.filter((name) => name.endsWith('public-api.ts'))).toEqual(['public-api.ts']);
    expect(services).toEqual(
      [
        'admin-orders.service.ts',
        'customer-orders.service.ts',
        'merchant-orders.service.ts',
        'order-analytics.service.ts',
        'order-creation.service.ts',
        'order-delivery.service.ts',
        'order-events.handler.ts',
        'order-messaging.service.ts',
        'order-rules.service.ts',
        'public-orders.service.ts',
      ].sort(),
    );
  });

  it('keeps Messenger persistence limited to its own Conversation and Message entities', () => {
    const module = source('src/features/communications/messenger/messenger.module.ts');
    const service = source('src/features/communications/messenger/messenger.service.ts');

    expect(module).toContain('TypeOrmModule.forFeature([Conversation, Message])');
    expect(module).not.toMatch(/\b(User|Order|Restaurant|ShippingDetail)\b.*forFeature/);
    expect(service).not.toMatch(/@InjectRepository\((User|Order|Restaurant|ShippingDetail)\)/);
    expect(service).toContain('OrderMessagingService');
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

  it('keeps Delivery dispatch on the Orders public API instead of the Order repository', () => {
    const deliveryModule = source('src/features/delivery/delivery.module.ts');
    const dispatch = source('src/features/delivery/services/delivery-dispatch.service.ts');
    const customerDelivery = source('src/features/delivery/services/customer-delivery.service.ts');

    expect(deliveryModule).not.toContain('entities/order.entity');
    expect(deliveryModule).not.toContain('      Order,');
    expect(dispatch).toContain('src/features/orders/public-api');
    expect(dispatch).toContain('OrderDeliveryService');
    expect(dispatch).not.toContain('DeliveryIntegrationService');
    expect(customerDelivery).not.toContain('entities/order.entity');
    expect(customerDelivery).toContain('assertCustomerCanTrackOrder');
  });

  it('keeps active shipper subscription behavior inside Delivery', () => {
    const orderResolver = source('src/features/orders/controllers/order.resolver.ts');
    const shipperResolver = source('src/features/delivery/controllers/shipper.resolver.ts');

    expect(orderResolver).not.toContain('ActiveShipperTrackerService');
    expect(orderResolver).not.toContain('orderConfirmedForShippers(');
    expect(shipperResolver).toContain('ActiveShipperTrackerService');
    expect(shipperResolver).toContain('orderConfirmedForShippers(');
    expect(shipperResolver).toContain('src/features/orders/public-api');
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
      'src/features/delivery/handlers/delivery-events.handler.ts',
    );
    expect(deliveryHandler).toContain('ORDER_STATUS_CHANGED_EVENT');
    expect(deliveryHandler).toContain('addPendingAssignment');
    expect(deliveryHandler).toContain('removePendingAssignment');
  });

  it('keeps Delivery completion on the Orders public API', () => {
    const completion = source(
      'src/features/delivery/services/delivery-trip.service.ts',
    );

    expect(completion).toContain('src/features/orders/public-api');
    expect(completion).toContain('OrderDeliveryService');
    expect(completion).not.toContain('entities/order.entity');
    expect(completion).not.toContain('orderRepository');
  });

  it('keeps Analytics on the main Orders public API', () => {
    const analyticsModule = source('src/features/analytics/analytics.module.ts');

    expect(analyticsModule).toContain("from 'src/features/orders/public-api'");
    expect(analyticsModule).toContain('OrdersModule');
    expect(analyticsModule).not.toContain('order-analytics-reader');

    for (const analyticsConsumer of [
      'src/features/analytics/services/analytics-projection.service.ts',
      'src/features/analytics/services/analytics-reconciliation.service.ts',
    ]) {
      expect(source(analyticsConsumer)).toContain('src/features/orders/public-api');
      expect(source(analyticsConsumer)).toContain('OrderAnalyticsService');
      expect(source(analyticsConsumer)).not.toContain('order-analytics-reader');
    }
  });

  it('keeps order review composition inside Reviews with a one-way dependency', () => {
    const ordersModule = source('src/features/orders/orders.module.ts');
    const orderRulesService = source('src/features/orders/services/order-rules.service.ts');
    const reviewsModule = source('src/features/reviews/reviews.module.ts');
    const reviewsService = source('src/features/reviews/services/customer-reviews.service.ts');

    expect(ordersModule).not.toContain('src/features/reviews');
    expect(ordersModule).not.toContain('OrderReviewReaderModule');
    expect(orderRulesService).not.toContain('src/features/reviews');
    expect(orderRulesService).not.toContain('reviewInfo');
    expect(reviewsModule).toContain('OrdersModule');
    expect(reviewsModule).toContain("from 'src/features/orders/public-api'");
    expect(reviewsService).toContain("from 'src/features/orders/public-api'");
    expect(reviewsService).toContain('getOrderReviewContext');
    expect(reviewsService).toContain('getOrderReviewInfo');
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

  it('keeps Chat on the main Orders messaging service without a dedicated adapter', () => {
    const ordersModule = source('src/features/orders/orders.module.ts');
    const ordersPublicApi = source('src/features/orders/public-api.ts');

    for (const chatConsumer of [
      'src/features/communications/chat/services/chat-context.service.ts',
      'src/features/communications/chat/flows/quick-reorder-flow.service.ts',
      'src/features/communications/chat/flows/order-conversation-flow.service.ts',
    ]) {
      const consumer = source(chatConsumer);
      expect(consumer).toContain("from 'src/features/orders/public-api'");
      expect(consumer).toContain('OrderMessagingService');
      expect(consumer).not.toContain('ChatOrderingService');
      expect(consumer).not.toContain('entities/order.entity');
      expect(consumer).not.toContain('InjectRepository');
    }

    expect(ordersModule).not.toContain('ChatOrderingService');
    expect(ordersPublicApi).not.toContain('ChatOrderingService');
  });

  it('keeps Delivery assignment state changes out of the legacy Order transaction', () => {
    const dispatch = source('src/features/delivery/services/delivery-dispatch.service.ts');
    const shipperDelivery = source(
      'src/features/delivery/services/shipper-delivery.service.ts',
    );
    const trip = source('src/features/delivery/services/delivery-trip.service.ts');
    expect(dispatch).toContain('deliveryTripService.assign');
    expect(dispatch).not.toContain('orderRepository');
    expect(shipperDelivery).toContain('pendingAssignmentService.assignOrderToShipper');
    expect(trip).not.toContain('entities/order.entity');
    expect(trip).toContain('DELIVERY_ASSIGNMENT_REQUESTED_EVENT');
  });

  it('routes shipper reads and lifecycle changes through the Orders public API', () => {
    const shipperDelivery = source(
      'src/features/delivery/services/shipper-delivery.service.ts',
    );

    expect(shipperDelivery).toContain('src/features/orders/public-api');
    expect(shipperDelivery).toContain('orderDelivery.startDelivery');
    expect(shipperDelivery).toContain('orderDelivery.cancelDelivery');
    expect(shipperDelivery).toContain('orderDelivery.getShipperOrder');
    expect(shipperDelivery).not.toContain('entities/order.entity');
    expect(shipperDelivery).not.toContain('orderRepository');
    expect(shipperDelivery).not.toContain('orderReassignedToShippers');
  });

  it('uses concrete infrastructure services through public APIs', () => {
    const orderCreation = source('src/features/orders/services/order-creation.service.ts');
    const adminOrders = source('src/features/orders/services/admin-orders.service.ts');
    const merchantOrders = source('src/features/orders/services/merchant-orders.service.ts');
    const publicPromotionsService = source(
      'src/features/promotions/services/public-promotions.service.ts',
    );
    const adminPromotionsService = source(
      'src/features/promotions/services/admin-promotions.service.ts',
    );

    expect(orderCreation).toContain('MapboxService');
    expect(orderCreation).toContain('src/infra/mapbox/public-api');
    expect(orderCreation).not.toContain('src/infra/mapbox/mapbox.service');
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
