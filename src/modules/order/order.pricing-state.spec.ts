import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Address } from 'src/entities/address.entity';
import { Order } from 'src/entities/order.entity';
import { Promotion, PromotionType } from 'src/entities/promotion.entity';
import { Restaurant, RestaurantStatus } from 'src/entities/restaurant.entity';
import { User } from 'src/entities/user.entity';
import { OrderCreateService } from './order-create.service';
import { OrderService } from './order.service';

jest.mock('src/pubsub', () => ({ pubSub: { publish: jest.fn().mockResolvedValue(true) } }));

describe('Order pricing and state characterization', () => {
  const createService = (overrides: Record<string, unknown> = {}) => {
    const dependencies = {
      orderRepository: { save: jest.fn(async (value) => value) },
      orderDetailRepository: {},
      userRepository: {},
      restaurantRepository: { findOne: jest.fn() },
      foodRepository: { findOne: jest.fn() },
      addressRepository: { findOne: jest.fn() },
      promotionRepository: {},
      dataSource: {},
      checkoutRepository: {},
      promotionService: {
        validatePromotion: jest.fn(),
        calculateDiscount: jest.fn(),
        usePromotion: jest.fn(),
        clearPromotionCache: jest.fn(),
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
      mapboxService: {
        calculateBikeRoute: jest.fn().mockResolvedValue({ distance: 5, duration: 1_200 }),
      },
      orderQueryService: { getOrderById: jest.fn() },
      orderCommandService: {
        updateStatus: jest.fn(),
        confirm: jest.fn(),
        markPaid: jest.fn(),
      },
      ...overrides,
    };

    const orderCreateService = new OrderCreateService(
      dependencies.foodRepository as never,
      dependencies.toppingRepository as never,
      dependencies.dataSource as never,
      dependencies.promotionService as never,
      dependencies.systemConstraintsService as never,
      dependencies.mapboxService as never,
      dependencies.orderQueryService as never,
    );

    const service = new OrderService(
      dependencies.orderRepository as never,
      dependencies.orderDetailRepository as never,
      dependencies.userRepository as never,
      dependencies.restaurantRepository as never,
      dependencies.foodRepository as never,
      dependencies.addressRepository as never,
      dependencies.promotionRepository as never,
      dependencies.dataSource as never,
      dependencies.checkoutRepository as never,
      dependencies.promotionService as never,
      dependencies.pendingAssignmentService as never,
      dependencies.eventBus as never,
      dependencies.toppingRepository as never,
      dependencies.systemConstraintsService as never,
      dependencies.mapboxService as never,
      dependencies.orderQueryService as never,
      dependencies.orderCommandService as never,
      orderCreateService,
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
          findOne: jest.fn(async (entity) => {
            if (entity === User) return { id: 'customer-1' };
            if (entity === Restaurant)
              return {
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
              };
            if (entity === Address)
              return {
                id: 'address-1',
                street: 'Customer street',
                ward: 'Ward',
                district: 'District',
                latitude: 10,
                longitude: 106,
              };
            if (entity === Promotion)
              return {
                id: 'promotion-1',
                code: 'PROMO',
                type: PromotionType.FOOD_DISCOUNT,
              };
            return null;
          }),
          save: jest.fn(async (entity, value) =>
            entity === Order ? Object.assign(value, { id: 'order-1' }) : value,
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
      dependencies.orderQueryService.getOrderById.mockImplementation(async () => {
        const savedCall = queryRunner.manager.save.mock.calls.find(([entity]) => entity === Order);
        return savedCall?.[1] as Order;
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
        expect(dependencies.promotionService.usePromotion).toHaveBeenCalledTimes(1);
        expect(dependencies.promotionService.usePromotion).toHaveBeenCalledWith(
          'PROMO',
          200_000,
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
        findOne: jest.fn(async (entity) => {
          if (entity === User) return { id: 'customer-1' };
          if (entity === Restaurant)
            return {
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
            };
          if (entity === Address)
            return {
              id: 'address-1',
              street: 'Customer street',
              ward: 'Ward',
              district: 'District',
              latitude: 10,
              longitude: 106,
            };
          return null;
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
    expect(dependencies.promotionService.usePromotion).not.toHaveBeenCalled();
  });
});
