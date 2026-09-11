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
    expect(service).toContain('ORDER_MESSAGING_READER');
    expect(service).toContain('RESTAURANT_READER');
    expect(service).toContain('IDENTITY_READER');
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

  it('uses ports and public APIs for Orders and Promotions technical dependencies', () => {
    const customerOrders = source('src/features/orders/services/customer-orders.service.ts');
    const adminOrders = source('src/features/orders/services/admin-orders.service.ts');
    const merchantOrders = source('src/features/orders/services/merchant-orders.service.ts');
    const promotionService = source('src/features/promotions/services/promotion.service.ts');

    expect(customerOrders).toContain('ROUTE_PORT');
    expect(customerOrders).not.toContain('src/infra/mapbox');
    expect(adminOrders).not.toContain('src/infra/queue');
    expect(merchantOrders).not.toContain('src/infra/queue');
    expect(promotionService).toContain('STORAGE_PORT');
    expect(promotionService).toContain('CACHE_PORT');
    expect(promotionService).not.toContain('src/infra/minio');
    expect(promotionService).not.toContain('src/infra/cache');
  });
});
