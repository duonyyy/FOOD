import { ChatContext, ChatMetadata } from '../types/chat.types';
import { createInitialChatMetadata } from '../utils/chat-metadata.factory';
import { OrderConversationFlowService } from './order-conversation-flow.service';
import { QuickReorderFlowService } from './quick-reorder-flow.service';

const context: ChatContext = { menuFlat: [], orderedFoods: [] };

describe('Chat flow policy', () => {
  it('requires explicit final confirmation before CreateOrder', async () => {
    const ordering = {
      createOrder: jest
        .fn()
        .mockResolvedValue({ orderId: 'order-1', total: 240_000, status: 'pending' }),
    };
    const validation = {
      parsePaymentMethod: jest.fn().mockReturnValue('cod'),
      validate: jest.fn().mockResolvedValue({
        valid: true,
        order: {
          restaurantId: 'restaurant-1',
          addressId: 'address-1',
          paymentMethod: 'cod',
          orderItems: [
            {
              foodId: 'food-1',
              name: 'Phở bò',
              quantity: 2,
              price: 120_000,
              restaurantId: 'restaurant-1',
            },
          ],
        },
      }),
    };
    const service = new OrderConversationFlowService(
      { listOwnedAddresses: jest.fn() } as never,
      ordering as never,
      validation as never,
      { parseOrderItems: jest.fn() } as never,
    );
    const metadata = createInitialChatMetadata();
    metadata.isOrdering = true;
    metadata.isFoodConfirmed = true;
    metadata.isRestaurantConfirmed = true;
    metadata.isAddressConfirmed = true;
    metadata.selectedAddress = {
      id: 'address-1',
      street: 'x',
      ward: null,
      district: null,
      city: 'TP.HCM',
    };

    const paymentReply = await service.continue('cod', 'customer-1', metadata, context);
    expect(paymentReply.action).toBe('confirmCreateOrder');
    expect(ordering.createOrder).not.toHaveBeenCalled();

    const refused = await service.continue(
      'không có',
      'customer-1',
      paymentReply.metadata as ChatMetadata,
      context,
    );
    expect(refused.action).toBe('confirmCreateOrder');
    expect(ordering.createOrder).not.toHaveBeenCalled();

    await service.continue('có', 'customer-1', paymentReply.metadata as ChatMetadata, context);
    expect(ordering.createOrder).toHaveBeenCalledWith({
      customerId: 'customer-1',
      restaurantId: 'restaurant-1',
      addressId: 'address-1',
      paymentMethod: 'cod',
      items: [{ foodId: 'food-1', quantity: 2 }],
    });
  });

  it('quick reorder rechecks current Catalog availability and does not reuse old price', async () => {
    const ordering = {
      getRecentOrdersForReorder: jest.fn().mockResolvedValue([
        {
          orderId: 'old-order',
          restaurantId: 'restaurant-1',
          totalAmount: 1,
          orderDetails: [{ foodId: 'food-1', foodName: 'Phở bò', quantity: 2, price: 1 }],
        },
      ]),
      createOrder: jest
        .fn()
        .mockResolvedValue({ orderId: 'new-order', total: 240_000, status: 'pending' }),
    };
    const catalogReader = {
      findAvailableFood: jest.fn().mockResolvedValue({
        foodId: 'food-1',
        restaurantId: 'restaurant-1',
        restaurantName: 'Quán A',
        name: 'Phở bò',
        description: null,
        image: null,
        price: 120_000,
      }),
    };
    const service = new QuickReorderFlowService(
      ordering as never,
      { listOwnedAddresses: jest.fn().mockResolvedValue([{ addressId: 'address-1' }]) } as never,
      catalogReader as never,
    );

    const pending = await service.continue('1', 'customer-1', createInitialChatMetadata());

    expect(pending.action).toBe('confirmCreateOrder');
    expect(ordering.createOrder).not.toHaveBeenCalled();

    await service.continue('có', 'customer-1', pending.metadata as ChatMetadata);

    expect(catalogReader.findAvailableFood).toHaveBeenCalledWith('food-1', 'restaurant-1');
    expect(ordering.createOrder).toHaveBeenCalledWith({
      customerId: 'customer-1',
      restaurantId: 'restaurant-1',
      addressId: 'address-1',
      paymentMethod: 'cod',
      items: [{ foodId: 'food-1', quantity: 2 }],
    });
  });
});
