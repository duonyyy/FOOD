import { Conversation, ConversationType } from 'src/entities/conversation.entity';
import { MessengerService } from 'src/features/communications/messenger/messenger.service';

describe('MessengerService boundary tests', () => {
  let conversationRepository: {
    createQueryBuilder: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };
  let messageRepository: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock };
  let identityReader: { findIdentityUser: jest.Mock; findIdentityUsers: jest.Mock };
  let restaurantReader: {
    findRestaurantForMessaging: jest.Mock;
    listActiveRestaurantsForMessaging: jest.Mock;
  };
  let orderMessagingReader: {
    findOrderForMessaging: jest.Mock;
    listCustomerShipperChatPartners: jest.Mock;
  };
  let service: MessengerService;

  beforeEach(() => {
    conversationRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
      save: jest.fn().mockImplementation(async (value) => ({ id: 'conversation-1', ...value })),
      findOne: jest.fn(),
    };
    messageRepository = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => ({ id: 'message-1', ...value })),
      findOne: jest.fn(),
    };
    identityReader = {
      findIdentityUser: jest.fn(),
      findIdentityUsers: jest.fn(),
    };
    restaurantReader = {
      findRestaurantForMessaging: jest.fn(),
      listActiveRestaurantsForMessaging: jest.fn(),
    };
    orderMessagingReader = {
      findOrderForMessaging: jest.fn(),
      listCustomerShipperChatPartners: jest.fn(),
    };
    service = new MessengerService(
      conversationRepository as never,
      messageRepository as never,
      identityReader as never,
      restaurantReader as never,
      orderMessagingReader as never,
      { publish: jest.fn() } as never,
    );
  });

  it('uses public readers and persists only User ID references when creating a shop conversation', async () => {
    restaurantReader.findRestaurantForMessaging.mockResolvedValue({
      restaurantId: 'restaurant-1',
      ownerId: 'owner-1',
      name: 'Shop',
      isActive: true,
    });
    identityReader.findIdentityUser.mockImplementation(async (id: string) => ({
      userId: id,
      username: id,
      name: null,
      roleName: id === 'owner-1' ? 'restaurant' : 'user',
      isActive: true,
    }));

    const conversation = await service.createOrGetConversation('customer-1', {
      restaurantId: 'restaurant-1',
      conversationType: ConversationType.CUSTOMER_SHOP,
    });

    expect(conversation.participant1).toEqual({ id: 'customer-1' });
    expect(conversation.participant2).toEqual({ id: 'owner-1' });
    expect(orderMessagingReader.findOrderForMessaging).not.toHaveBeenCalled();
    expect(conversationRepository.save).toHaveBeenCalledWith(expect.any(Conversation));
  });

  it('refuses a shipper conversation when the public order projection belongs to another customer', async () => {
    restaurantReader.findRestaurantForMessaging.mockResolvedValue({
      restaurantId: 'restaurant-1',
      ownerId: 'owner-1',
      name: 'Shop',
      isActive: true,
    });
    identityReader.findIdentityUser.mockResolvedValue({
      userId: 'customer-1',
      username: 'customer',
      name: null,
      roleName: 'user',
      isActive: true,
    });
    orderMessagingReader.findOrderForMessaging.mockResolvedValue({
      orderId: 'order-1',
      customerId: 'another-customer',
      shipperId: 'shipper-1',
      status: 'confirmed',
    });

    await expect(
      service.createOrGetConversation('customer-1', {
        participantId: 'shipper-1',
        restaurantId: 'restaurant-1',
        orderId: 'order-1',
        conversationType: ConversationType.CUSTOMER_SHIPPER,
      }),
    ).rejects.toThrow('Order not found or does not belong to you');
  });

  it('maps chat partners from public snapshots without exposing User entities', async () => {
    identityReader.findIdentityUser.mockResolvedValue({
      userId: 'customer-1',
      username: 'customer',
      name: 'Customer',
      roleName: 'user',
      isActive: true,
    });
    restaurantReader.listActiveRestaurantsForMessaging.mockResolvedValue([
      { restaurantId: 'restaurant-1', ownerId: 'owner-1', name: 'Shop', isActive: true },
    ]);
    orderMessagingReader.listCustomerShipperChatPartners.mockResolvedValue([
      {
        orderId: 'order-1',
        customerId: 'customer-1',
        shipperId: 'shipper-1',
        status: 'delivering',
      },
    ]);
    identityReader.findIdentityUsers.mockResolvedValue([
      {
        userId: 'owner-1',
        username: 'owner',
        name: 'Owner',
        roleName: 'restaurant',
        isActive: true,
      },
      {
        userId: 'shipper-1',
        username: 'shipper',
        name: 'Shipper',
        roleName: 'shipper',
        isActive: true,
      },
    ]);

    await expect(service.getAvailableChatPartners('customer-1')).resolves.toEqual({
      shopOwners: [
        {
          user: { id: 'owner-1', username: 'owner', name: 'Owner', roleName: 'restaurant' },
          restaurant: { id: 'restaurant-1', name: 'Shop' },
        },
      ],
      shippers: [
        {
          user: { id: 'shipper-1', username: 'shipper', name: 'Shipper', roleName: 'shipper' },
          order: { id: 'order-1', status: 'delivering' },
        },
      ],
    });
  });
});
