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
    expect(service).toContain('OrderMessagingReaderService');
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

  it('keeps Delivery completion on a narrow Orders reader contract', () => {
    const completion = source(
      'src/features/delivery/services/shipper/delivery-completion.service.ts',
    );

    expect(completion).toContain('order-delivery-completion-reader.public-api');
    expect(completion).not.toContain('entities/order.entity');
    expect(completion).not.toContain('orderRepository');
  });

  it('uses ports through infrastructure public APIs for Orders and Promotions technical dependencies', () => {
    const customerOrders = source('src/features/orders/services/customer-orders.service.ts');
    const adminOrders = source('src/features/orders/services/admin-orders.service.ts');
    const merchantOrders = source('src/features/orders/services/merchant-orders.service.ts');
    const promotionService = source('src/features/promotions/services/promotion.service.ts');

    expect(customerOrders).toContain('ROUTE_PORT');
    expect(customerOrders).toContain('src/infra/mapbox/public-api');
    expect(customerOrders).not.toContain('src/infra/mapbox/route-port.adapter');
    expect(adminOrders).not.toContain('src/infra/queue/queue.service');
    expect(merchantOrders).not.toContain('src/infra/queue/queue.service');
    expect(promotionService).toContain('STORAGE_PORT');
    expect(promotionService).toContain('CACHE_PORT');
    expect(promotionService).not.toContain('src/infra/minio');
    expect(promotionService).toContain('src/infra/cache/public-api');
    expect(promotionService).not.toContain('src/infra/cache/cache.service');
  });
});
