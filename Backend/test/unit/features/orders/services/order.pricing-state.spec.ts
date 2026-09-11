import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Address } from 'src/entities/address.entity';
import { Order } from 'src/entities/order.entity';
import { Promotion, PromotionType } from 'src/entities/promotion.entity';
import { Restaurant, RestaurantStatus } from 'src/entities/restaurant.entity';
import { User } from 'src/entities/user.entity';
import { AdminOrdersService } from 'src/features/orders/services/admin-orders.service';
import { CustomerOrdersService } from 'src/features/orders/services/customer-orders.service';
import { MerchantOrdersService } from 'src/features/orders/services/merchant-orders.service';
import { OrderCoreService } from 'src/features/orders/services/order-core.service';
import { OrderService } from 'src/features/orders/services/order.service';

jest.mock('src/pubsub', () => ({ pubSub: { publish: jest.fn().mockResolvedValue(true) } }));

describe('Order pricing and state characterization', () => {
  const createService = (overrides: Record<string, unknown> = {}) => {
    const dependencies = {
      orderRepository: {
        save: jest.fn((value: unknown) => Promise.resolve(value)),
      },
      orderDetailRepository: {},
      userRepository: {},
      restaurantRepository: {
        findOne: jest.fn().mockResolvedValue({
          id: 'restaurant-1',
          status: RestaurantStatus.APPROVED,
          address: { latitude: 10.1, longitude: 106.1 },
        }),
      },
      foodRepository: {
        findOne: jest.fn().mockResolvedValue({
          id: 'food-1',
          name: 'Food',
          price: 100_000,
          discountPercent: 10,
          status: 'available',
          restaurant: { id: 'restaurant-1' },
        }),
      },
      addressRepository: {
        findOne: jest.fn().mockResolvedValue({
          id: 'address-1',
          street: 'Street',
          ward: 'Ward',
          district: 'District',
          city: 'City',
          latitude: 10,
          longitude: 106,
        }),
      },
      promotionRepository: {},
      dataSource: {},
      checkoutRepository: {},
      promotionService: {
        validatePromotion: jest.fn(),
        calculateDiscount: jest.fn(),
        usePromotion: jest.fn(),
        clearPromotionCache: jest.fn(),
      },
      promotionRedemptionService: {
        redeemInTransaction: jest.fn().mockResolvedValue({
          promotion: { id: 'promotion-1', code: 'PROMO' },
        }),
      },
      outboxService: {
        enqueue: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
        dispatchAfterCommit: jest.fn().mockResolvedValue(undefined),
      },
      pendingAssignmentService: {},
      reviewRepository: {},
      eventBus: { publish: jest.fn().mockResolvedValue(undefined) },
      shippingDetailRepository: {},
      toppingRepository: { findOne: jest.fn() },
      systemConstraintsService: {
        calculateShippingFee: jest.fn().mockResolvedValue(20_000),
        getMaxDeliveryTime: jest.fn().mockResolvedValue(90),
      },
      routePort: {
        getDistanceAndDuration: jest.fn().mockResolvedValue({ distanceKm: 5, durationMin: 20 }),
      },
      orderQueryService: { getOrderById: jest.fn() },
      orderCommandService: {
        updateStatus: jest.fn(),
        confirm: jest.fn(),
        markPaid: jest.fn(),
      },
      menuReader: {
        getOrderableItems: jest.fn().mockImplementation(async ({ items }) => {
          return Promise.all(
            items.map(async (i: { foodId: string; toppingIds: string[] }) => {
              const food = await dependencies.foodRepository.findOne();
              if (!food) {
                throw new NotFoundException('Food not found');
              }
              const toppings = await Promise.all(
                (i.toppingIds ?? []).map(async (tid: string) => {
                  const t = await dependencies.toppingRepository.findOne();
                  return {
                    toppingId: t?.id ?? tid,
                    name: t?.name ?? 'Topping',
                    unitPrice: t?.price ?? 0,
                    isAvailable: t?.isAvailable ?? true,
                  };
                }),
              );
              return {
                foodId: food.id ?? i.foodId,
                restaurantId: food.restaurant?.id ?? 'restaurant-1',
                name: food.name ?? 'Food',
                unitPrice: food.price ?? 0,
                discountPercent: food.discountPercent ?? 0,
                status: food.status ?? 'available',
                isAvailable: food.status === 'available' && toppings.every((t) => t.isAvailable),
                toppings,
              };
            }),
          );
        }),
      },
      locationReader: {
        findAddress: jest.fn().mockImplementation(async () => {
          const addr = await dependencies.addressRepository.findOne();
          return addr
            ? {
                addressId: addr.id ?? 'address-1',
                street: addr.street ?? 'Street',
                ward: addr.ward ?? 'Ward',
                district: addr.district ?? 'District',
                city: addr.city ?? 'City',
                latitude: addr.latitude,
                longitude: addr.longitude,
                isTemporary: false,
              }
            : null;
        }),
        findOwnedAddress: jest.fn().mockImplementation(async () => {
          const addr = await dependencies.addressRepository.findOne();
          return addr
            ? {
                addressId: addr.id ?? 'address-1',
                street: addr.street ?? 'Street',
                ward: addr.ward ?? 'Ward',
                district: addr.district ?? 'District',
                city: addr.city ?? 'City',
                latitude: addr.latitude,
                longitude: addr.longitude,
                isTemporary: false,
              }
            : null;
        }),
        findTemporaryAddress: jest.fn().mockImplementation(async () => {
          const addr = await dependencies.addressRepository.findOne();
          return addr
            ? {
                addressId: addr.id ?? 'address-1',
                street: addr.street ?? 'Street',
                ward: addr.ward ?? 'Ward',
                district: addr.district ?? 'District',
                city: addr.city ?? 'City',
                latitude: addr.latitude,
                longitude: addr.longitude,
                isTemporary: true,
              }
            : null;
        }),
      },
      locationWriter: {
        writeAddress: jest.fn().mockResolvedValue({ addressId: 'temp-addr-1' }),
        removeAddress: jest.fn().mockResolvedValue(undefined),
        removeExpiredTemporaryAddresses: jest.fn().mockResolvedValue(0),
      },
      restaurantReader: {
        findActiveRestaurant: jest.fn().mockImplementation(async () => {
          const r = await dependencies.restaurantRepository.findOne();
          return r?.status === RestaurantStatus.APPROVED
            ? {
                restaurantId: r.id ?? 'restaurant-1',
                ownerId: 'owner-1',
                name: r.name ?? 'Restaurant',
                isActive: true,
                location: r.address
                  ? { latitude: r.address.latitude, longitude: r.address.longitude }
                  : null,
              }
            : null;
        }),
      },
      identityReader: {
        findIdentityUser: jest.fn().mockImplementation(async (userId: string) => ({
          userId,
          username: 'user',
          name: 'User',
          roleName: 'user',
          isActive: true,
        })),
      },
      ...overrides,
    };

    const orderCoreService = {
      getOrderById: dependencies.orderQueryService.getOrderById,
      cleanSensitiveData: jest.fn((o) => o),
    } as unknown as OrderCoreService;

    const customerOrdersService = new CustomerOrdersService(
      dependencies.orderRepository as never,
      dependencies.orderDetailRepository as never,
      dependencies.dataSource as never,
      dependencies.promotionService as never,
      dependencies.promotionRedemptionService as never,
      dependencies.outboxService as never,
      dependencies.systemConstraintsService as never,
      dependencies.routePort as never,
      orderCoreService,
      dependencies.menuReader as never,
      dependencies.locationReader as never,
      dependencies.locationWriter as never,
      dependencies.restaurantReader as never,
      dependencies.identityReader as never,
    );

    const merchantOrdersService = {
      updateOrderStatus: dependencies.orderCommandService.updateStatus,
      confirmOrder: dependencies.orderCommandService.confirm,
      getOrdersByRestaurant: jest.fn(),
    } as unknown as MerchantOrdersService;

    const adminOrdersService = {
      markPaid: dependencies.orderCommandService.markPaid,
      getAllOrders: jest.fn(),
      adminUpdateOrderStatus: dependencies.orderCommandService.updateStatus,
    } as unknown as AdminOrdersService;

    const service = new OrderService(
      customerOrdersService,
      merchantOrdersService,
      adminOrdersService,
      orderCoreService,
    );

    return { service, dependencies };
  };

  it('calculates subtotal, DB topping price, DB discount, shipping fee and total', async () => {
    const { service, dependencies } = createService();
    dependencies.addressRepository.findOne.mockResolvedValue({ latitude: 10, longitude: 106 });
    dependencies.restaurantRepository.findOne.mockResolvedValue({
      id: 'restaurant-1',
      status: RestaurantStatus.APPROVED,
      address: { latitude: 10.1, longitude: 106.1 },
    });
    dependencies.foodRepository.findOne.mockResolvedValue({
      id: 'food-1',
      price: 100_000,
      discountPercent: 10,
      status: 'available',
      restaurant: { id: 'restaurant-1' },
    });
    dependencies.toppingRepository.findOne.mockResolvedValue({
      id: 'topping-1',
      price: 5_000,
      isAvailable: true,
    });
    dependencies.promotionService.validatePromotion.mockResolvedValue({
      valid: true,
      promotion: { id: 'promotion-1' },
      calculatedDiscount: 15_000,
    });

    const result = await service.calculateOrder({
      addressId: 'address-1',
      restaurantId: 'restaurant-1',
      items: [
        {
          foodId: 'food-1',
          quantity: 2,
          discountPercent: 100,
          toppings: [{ id: 'topping-1', price: 1 }],
        },
      ],
      promotionCode: 'PROMO',
    });

    expect(result).toMatchObject({
      foodTotal: 190_000,
      shippingFee: 20_000,
      subtotal: 210_000,
      promotionDiscount: 15_000,
      total: 195_000,
      distance: 5,
      estimatedDeliveryTime: 20,
    });
  });

  it('rejects an inactive restaurant', async () => {
    const { service, dependencies } = createService();
    dependencies.addressRepository.findOne.mockResolvedValue({ latitude: 10, longitude: 106 });
    dependencies.restaurantRepository.findOne.mockResolvedValue({
      id: 'restaurant-1',
      status: RestaurantStatus.PENDING,
      address: { latitude: 10.1, longitude: 106.1 },
    });

    await expect(
      service.calculateOrder({
        addressId: 'address-1',
        restaurantId: 'restaurant-1',
        items: [{ foodId: 'food-1', quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a missing food instead of silently pricing it as zero', async () => {
    const { service, dependencies } = createService();
    dependencies.addressRepository.findOne.mockResolvedValue({ latitude: 10, longitude: 106 });
    dependencies.restaurantRepository.findOne.mockResolvedValue({
      id: 'restaurant-1',
      status: RestaurantStatus.APPROVED,
      address: { latitude: 10.1, longitude: 106.1 },
    });
    dependencies.foodRepository.findOne.mockResolvedValue(null);

    await expect(
      service.calculateOrder({
        addressId: 'address-1',
        restaurantId: 'restaurant-1',
        items: [{ foodId: 'missing-food', quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows a valid pending -> confirmed transition', async () => {
    const { service, dependencies } = createService();
    dependencies.orderCommandService.updateStatus.mockResolvedValue({
      id: 'order-1',
      status: 'confirmed',
    });

    await expect(service.updateOrderStatus('order-1', 'confirmed')).resolves.toMatchObject({
      status: 'confirmed',
    });
    expect(dependencies.orderCommandService.updateStatus).toHaveBeenCalledWith(
      'order-1',
      'confirmed',
    );
  });

  it('rejects an invalid pending -> completed transition and terminal transitions', async () => {
    const { service, dependencies } = createService();
    dependencies.orderCommandService.updateStatus
      .mockRejectedValueOnce(new BadRequestException('Cannot change status'))
      .mockRejectedValueOnce(new BadRequestException('Cannot change status'));

    await expect(service.updateOrderStatus('order-1', 'completed')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateOrderStatus('order-2', 'canceled')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each([
    ['cod', 'pending', undefined, 200_000],
    ['momo', 'processing_payment', undefined, 200_000],
    ['momo', 'processing_payment', 'PROMO', 190_000],
  ])(
    'creates %s order with server total and status %s (promotion=%s)',
    async (paymentMethod, expectedStatus, promotionCode, expectedTotal) => {
      const queryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        isTransactionActive: true,
        manager: {
          findOne: jest.fn((entity: unknown) => {
            if (entity === User) return Promise.resolve({ id: 'customer-1' });
            if (entity === Restaurant)
              return Promise.resolve({
                id: 'restaurant-1',
                name: 'Store',
                status: RestaurantStatus.APPROVED,
                address: {
                  street: 'Store street',
                  ward: 'Ward',
                  district: 'District',
                  latitude: 10.1,
                  longitude: 106.1,
                },
              });
            if (entity === Address)
              return Promise.resolve({
                id: 'address-1',
                street: 'Customer street',
                ward: 'Ward',
                district: 'District',
                latitude: 10,
                longitude: 106,
              });
            if (entity === Promotion)
              return Promise.resolve({
                id: 'promotion-1',
                code: 'PROMO',
                type: PromotionType.FOOD_DISCOUNT,
              });
            return Promise.resolve(null);
          }),
          save: jest.fn((entity: unknown, value: unknown) =>
            Promise.resolve(
              entity === Order && typeof value === 'object' && value !== null
                ? Object.assign(value, { id: 'order-1' })
                : value,
            ),
          ),
        },
      };
      const { service, dependencies } = createService({
        dataSource: { createQueryRunner: jest.fn().mockReturnValue(queryRunner) },
        systemConstraintsService: {
          getConstraints: jest.fn().mockResolvedValue({
            max_delivery_distance: 20,
            max_delivery_time_min: 180,
          }),
          isDistanceWithinLimits: jest.fn().mockResolvedValue(true),
          calculateShippingFee: jest.fn().mockResolvedValue(20_000),
          getMaxDeliveryTime: jest.fn().mockResolvedValue(90),
        },
      });
      dependencies.foodRepository.findOne.mockResolvedValue({
        id: 'food-1',
        name: 'Food',
        price: 100_000,
        discountPercent: 10,
        status: 'available',
        restaurant: { id: 'restaurant-1' },
      });
      dependencies.promotionService.validatePromotion.mockResolvedValue({
        valid: true,
        promotion: {
          id: 'promotion-1',
          code: 'PROMO',
          type: PromotionType.FOOD_DISCOUNT,
        },
        calculatedDiscount: 10_000,
      });
      dependencies.promotionService.usePromotion.mockResolvedValue({ id: 'promotion-1' });
      dependencies.orderQueryService.getOrderById.mockImplementation(() => {
        const savedCall = queryRunner.manager.save.mock.calls.find(([entity]) => entity === Order);
        return Promise.resolve(savedCall?.[1] as Order);
      });

      const result = await service.createOrder({
        userId: 'customer-1',
        restaurantId: 'restaurant-1',
        addressId: 'address-1',
        total: 1,
        paymentMethod,
        promotionCode,
        orderDetails: [
          {
            foodId: 'food-1',
            quantity: '2',
            price: '1',
            discountPercent: 100,
          },
        ],
      });

      expect(result.status).toBe(expectedStatus);
      expect(result.total).toBe(expectedTotal);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      if (promotionCode) {
        expect(dependencies.promotionRedemptionService.redeemInTransaction).toHaveBeenCalledTimes(
          1,
        );
        expect(dependencies.promotionRedemptionService.redeemInTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            orderId: 'order-1',
            promotionCode: 'PROMO',
            customerId: 'customer-1',
          }),
          queryRunner.manager,
        );
      }
    },
  );

  it('rolls back the order transaction when promotion validation fails', async () => {
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      isTransactionActive: true,
      manager: {
        findOne: jest.fn((entity: unknown) => {
          if (entity === User) return Promise.resolve({ id: 'customer-1' });
          if (entity === Restaurant)
            return Promise.resolve({
              id: 'restaurant-1',
              name: 'Store',
              status: RestaurantStatus.APPROVED,
              address: {
                street: 'Store street',
                ward: 'Ward',
                district: 'District',
                latitude: 10.1,
                longitude: 106.1,
              },
            });
          if (entity === Address)
            return Promise.resolve({
              id: 'address-1',
              street: 'Customer street',
              ward: 'Ward',
              district: 'District',
              latitude: 10,
              longitude: 106,
            });
          return Promise.resolve(null);
        }),
        save: jest.fn(),
      },
    };
    const { service, dependencies } = createService({
      dataSource: { createQueryRunner: jest.fn().mockReturnValue(queryRunner) },
      systemConstraintsService: {
        getConstraints: jest.fn().mockResolvedValue({
          max_delivery_distance: 20,
          max_delivery_time_min: 180,
        }),
        isDistanceWithinLimits: jest.fn().mockResolvedValue(true),
        calculateShippingFee: jest.fn().mockResolvedValue(20_000),
        getMaxDeliveryTime: jest.fn().mockResolvedValue(90),
      },
    });
    dependencies.foodRepository.findOne.mockResolvedValue({
      id: 'food-1',
      name: 'Food',
      price: 100_000,
      discountPercent: 10,
      status: 'available',
      restaurant: { id: 'restaurant-1' },
    });
    dependencies.promotionService.validatePromotion.mockResolvedValue({
      valid: false,
      reason: 'Promotion usage limit reached',
    });

    await expect(
      service.createOrder({
        userId: 'customer-1',
        restaurantId: 'restaurant-1',
        addressId: 'address-1',
        paymentMethod: 'momo',
        promotionCode: 'FULL',
        orderDetails: [{ foodId: 'food-1', quantity: '1', price: '1' }],
      }),
    ).rejects.toThrow('Promotion usage limit reached');

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(dependencies.promotionRedemptionService.redeemInTransaction).not.toHaveBeenCalled();
  });
});
