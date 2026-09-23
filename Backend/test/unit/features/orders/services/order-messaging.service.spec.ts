import { OrderMessagingService } from 'src/features/orders/services/order-messaging.service';

describe('OrderMessagingService', () => {
  const createService = () => {
    const customerOrdersService = {
      getMinimalOrderHistoryForQuickReorder: jest.fn(),
      createOrder: jest.fn(),
    };
    const service = new OrderMessagingService(
      customerOrdersService as never,
      {} as never,
    );

    return { service, customerOrdersService };
  };

  it('maps recent order snapshots for Chat without exposing Order entities', async () => {
    const { service, customerOrdersService } = createService();
    customerOrdersService.getMinimalOrderHistoryForQuickReorder.mockResolvedValue([
      {
        orderId: 'order-1',
        restaurantId: null,
        totalAmount: '125000',
        orderDetails: [
          {
            foodId: null,
            foodName: 'Phở bò',
            quantity: '2',
            price: '62500',
          },
        ],
      },
    ]);

    await expect(service.getRecentOrdersForReorder('customer-1', 5)).resolves.toEqual([
      {
        orderId: 'order-1',
        restaurantId: undefined,
        totalAmount: 125000,
        orderDetails: [
          {
            foodId: undefined,
            foodName: 'Phở bò',
            quantity: 2,
            price: 62500,
          },
        ],
      },
    ]);
    expect(customerOrdersService.getMinimalOrderHistoryForQuickReorder).toHaveBeenCalledWith(
      'customer-1',
      5,
    );
  });

  it('binds the authenticated customer and leaves pricing to Orders', async () => {
    const { service, customerOrdersService } = createService();
    customerOrdersService.createOrder.mockResolvedValue({
      id: 'order-2',
      total: '240000',
      status: 'pending',
    });

    await expect(
      service.createChatOrder({
        customerId: 'customer-1',
        restaurantId: 'restaurant-1',
        addressId: 'address-1',
        paymentMethod: 'cod',
        items: [{ foodId: 'food-1', quantity: 2 }],
      }),
    ).resolves.toEqual({ orderId: 'order-2', total: 240000, status: 'pending' });

    expect(customerOrdersService.createOrder).toHaveBeenCalledWith({
      userId: 'customer-1',
      restaurantId: 'restaurant-1',
      addressId: 'address-1',
      paymentMethod: 'cod',
      orderDetails: [
        {
          foodId: 'food-1',
          quantity: '2',
          price: '0',
          selectedToppings: [],
        },
      ],
    });
  });
});
