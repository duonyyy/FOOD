import { MODULE_METADATA } from '@nestjs/common/constants';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CustomerDeliveryService, DeliveryModule } from 'src/features/delivery/public-api';
import { DeliveryDispatchService } from 'src/features/delivery/services/delivery-dispatch.service';
import {
  ShipperProfileModule,
  ShipperProfileService,
} from 'src/features/delivery/shipper-profile.public-api';
import { AddressService, LocationsModule } from 'src/features/locations/public-api';
import {
  CategoryService,
  FoodAdminService,
  FoodCustomerService,
  FoodIntegrationService,
  FoodMerchantService,
  FoodToppingService,
  MenuModule,
  type CatalogChatFood,
  type CategorySummary,
  type FoodPreview,
  type GetOrderableItemsRequest,
} from 'src/features/menu/public-api';
import {
  OrderAnalyticsService,
  OrderDeliveryService,
  OrderMessagingService,
  OrderRulesService,
  OrdersModule,
} from 'src/features/orders/public-api';
import { PaymentModule, PaymentService } from 'src/features/payments/public-api';
import {
  CustomerRestaurantsService,
  MerchantRestaurantsService,
  PublicRestaurantsService,
  RestaurantsModule,
} from 'src/features/restaurants/public-api';
import { AdminRestaurantsService } from 'src/features/restaurants/services/admin-restaurants.service';
import { IdentityModule, IdentityUserQueryService } from 'src/features/users/public-api';

describe('feature public contracts', () => {
  it('registers each Menu provider once in MenuModule', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, MenuModule) as unknown[];
    const expected = [
      CategoryService,
      FoodCustomerService,
      FoodMerchantService,
      FoodAdminService,
      FoodToppingService,
      FoodIntegrationService,
    ];

    expect(new Set(providers)).toEqual(new Set(expected));
    expect(new Set(providers).size).toBe(providers.length);
  });

  it('exports CategoryService as the Menu public concrete service', () => {
    const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, MenuModule) as unknown[];

    expect(exports).toContain(CategoryService);
  });

  it('exports FoodIntegrationService as the Menu public concrete service', () => {
    const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, MenuModule) as unknown[];

    expect(exports).toContain(FoodIntegrationService);
  });

  it('exports the Phase 2 concrete services from their owning modules', () => {
    const restaurantExports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      RestaurantsModule,
    ) as unknown[];
    const locationsExports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      LocationsModule,
    ) as unknown[];
    const identityExports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      IdentityModule,
    ) as unknown[];

    expect(restaurantExports).toEqual([
      PublicRestaurantsService,
      CustomerRestaurantsService,
      MerchantRestaurantsService,
    ]);
    expect(locationsExports).toContain(AddressService);
    expect(identityExports).toContain(IdentityUserQueryService);
    expect(IdentityModule).toBeDefined();
  });

  it('registers role services once and keeps the Menu dependency one-way', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, RestaurantsModule) as unknown[];
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      RestaurantsModule,
    ) as unknown[];
    const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, RestaurantsModule) as unknown[];

    const menuImports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, MenuModule) as unknown[];
    expect(imports).not.toContain(MenuModule);
    expect(menuImports).toContain(RestaurantsModule);
    expect(providers).toEqual([
      PublicRestaurantsService,
      CustomerRestaurantsService,
      MerchantRestaurantsService,
      AdminRestaurantsService,
    ]);
    expect(exports).toEqual([
      PublicRestaurantsService,
      CustomerRestaurantsService,
      MerchantRestaurantsService,
    ]);
    expect(new Set(providers).size).toBe(providers.length);
  });

  it('keeps Delivery on the main Orders public API', () => {
    const deliveryModule = readFileSync(
      resolve(process.cwd(), 'src/features/delivery/delivery.module.ts'),
      'utf8',
    );
    const customerDeliveryService = readFileSync(
      resolve(process.cwd(), 'src/features/delivery/services/customer-delivery.service.ts'),
      'utf8',
    );
    const ordersExports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, OrdersModule) as unknown[];
    expect(ordersExports).toContain(OrderDeliveryService);
    expect(deliveryModule).toContain("from '../orders/public-api'");
    expect(deliveryModule).toContain('OrdersModule');
    expect(customerDeliveryService).toContain('src/features/orders/public-api');
    expect(customerDeliveryService).toContain('OrderDeliveryService');
  });

  it('keeps Analytics on the main Orders public API', () => {
    const analyticsModule = readFileSync(
      resolve(process.cwd(), 'src/features/analytics/analytics.module.ts'),
      'utf8',
    );

    const ordersExports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, OrdersModule) as unknown[];
    expect(ordersExports).toContain(OrderAnalyticsService);
    expect(analyticsModule).toContain("from 'src/features/orders/public-api'");
    expect(analyticsModule).toContain('OrdersModule');
    expect(analyticsModule).not.toContain('order-analytics-reader');
  });

  it('keeps Menu read models independent from ORM entities', () => {
    const menuRequest: GetOrderableItemsRequest = {
      items: [{ foodId: 'food-id', toppingIds: [] }],
    };
    const catalogFood: CatalogChatFood = {
      foodId: 'food-id',
      restaurantId: 'restaurant-id',
      restaurantName: 'Restaurant',
      name: 'Food',
      description: null,
      image: null,
      price: 10_000,
    };
    const foodPreview: FoodPreview = {
      foodId: 'food-id',
      name: 'Food',
      image: null,
      price: 10_000,
      rating: null,
      soldCount: null,
    };
    const categorySummary: CategorySummary = {
      categoryId: 'category-id',
      name: 'Main course',
      image: null,
      foodCount: 0,
    };
    expect(FoodIntegrationService).toBeDefined();
    expect(menuRequest).toBeDefined();
    expect(catalogFood).toBeDefined();
    expect(foodPreview).toBeDefined();
    expect(CategoryService).toBeDefined();
    expect(categorySummary).toBeDefined();
    const categoryTypes = readFileSync(
      resolve(process.cwd(), 'src/features/menu/types/category.types.ts'),
      'utf8',
    );
    expect(categoryTypes).not.toMatch(/typeorm|entities\//i);
  });

  it('exports Phase 3 concrete services from their owner modules', () => {
    const ordersExports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, OrdersModule) as unknown[];
    const deliveryExports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      DeliveryModule,
    ) as unknown[];
    const profileExports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      ShipperProfileModule,
    ) as unknown[];
    const paymentExports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, PaymentModule) as unknown[];

    expect(ordersExports).toEqual(
      expect.arrayContaining([
        OrderAnalyticsService,
        OrderDeliveryService,
        OrderMessagingService,
        OrderRulesService,
      ]),
    );
    expect(deliveryExports).toContain(CustomerDeliveryService);
    expect(deliveryExports).toEqual([CustomerDeliveryService, DeliveryDispatchService]);
    expect(profileExports).toContain(ShipperProfileService);
    expect(paymentExports).toContain(PaymentService);
  });

  it('keeps Menu consumers on FoodIntegrationService through the public API', () => {
    const consumers = [
      'src/features/orders/services/order-creation.service.ts',
      'src/features/reviews/services/customer-reviews.service.ts',
      'src/features/communications/chat/services/chat-context.service.ts',
      'src/features/communications/chat/flows/quick-reorder-flow.service.ts',
      'src/features/communications/chat/services/chat-order-validation.service.ts',
    ];

    for (const consumerPath of consumers) {
      const source = readFileSync(resolve(process.cwd(), consumerPath), 'utf8');

      expect(source).toContain('src/features/menu/public-api');
      expect(source).toContain('FoodIntegrationService');
    }

    const ordersModule = readFileSync(
      resolve(process.cwd(), 'src/features/orders/orders.module.ts'),
      'utf8',
    );
    expect(ordersModule).toContain("import { MenuModule } from 'src/features/menu/public-api';");
  });

  it('keeps Phase 2 consumers on owner public APIs and concrete services', () => {
    const consumers = [
      ['src/features/menu/foods/services/food-customer.service.ts', 'CustomerRestaurantsService'],
      ['src/features/menu/foods/services/food-merchant.service.ts', 'MerchantRestaurantsService'],
      ['src/features/menu/foods/services/food-topping.service.ts', 'MerchantRestaurantsService'],
      ['src/features/orders/services/order-creation.service.ts', 'AddressService'],
      ['src/features/orders/services/order-creation.service.ts', 'CustomerRestaurantsService'],
      ['src/features/orders/services/order-creation.service.ts', 'IdentityUserQueryService'],
      ['src/features/orders/controllers/order.resolver.ts', 'CustomerRestaurantsService'],
      ['src/features/restaurants/services/merchant-restaurants.service.ts', 'AddressService'],
      [
        'src/features/restaurants/services/merchant-restaurants.service.ts',
        'IdentityUserQueryService',
      ],
      ['src/features/delivery/services/admin-delivery.service.ts', 'IdentityUserQueryService'],
      ['src/features/communications/messenger/messenger.service.ts', 'CustomerRestaurantsService'],
      ['src/features/communications/messenger/messenger.service.ts', 'IdentityUserQueryService'],
      [
        'src/features/communications/chat/services/chat-order-validation.service.ts',
        'AddressService',
      ],
      ['src/features/communications/chat/flows/quick-reorder-flow.service.ts', 'AddressService'],
      [
        'src/features/communications/chat/flows/order-conversation-flow.service.ts',
        'AddressService',
      ],
    ] as const;

    for (const [consumerPath, concreteService] of consumers) {
      const source = readFileSync(resolve(process.cwd(), consumerPath), 'utf8');

      expect(source).toContain('public-api');
      expect(source).toContain(concreteService);
    }
  });
});
