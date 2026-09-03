import { ChatMetadata } from '../types/chat.types';
import { ChatOrderValidationService } from './chat-order-validation.service';

describe('ChatOrderValidationService', () => {
  it('revalidates address, availability and current Catalog price', async () => {
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
    const locationReader = {
      listOwnedAddresses: jest.fn().mockResolvedValue([
        {
          addressId: 'address-1',
          street: '1 Nguyễn Huệ',
          ward: 'Bến Nghé',
          district: 'Quận 1',
          city: 'TP.HCM',
          latitude: 10,
          longitude: 106,
          isTemporary: false,
        },
      ]),
    };
    const service = new ChatOrderValidationService(catalogReader as never, locationReader as never);
    const metadata: ChatMetadata = {
      orderItems: [
        {
          id: 'food-1',
          name: 'Tên do client sửa',
          quantity: 2,
          price: 1,
          restaurantId: 'restaurant-1',
        },
      ],
      addresses: [],
      selectedAddress: {
        id: 'address-1',
        street: 'địa chỉ cũ',
        ward: null,
        district: null,
        city: 'TP.HCM',
      },
      selectedPaymentMethod: 'cod',
      isOrdering: true,
      isFoodConfirmed: true,
      isRestaurantConfirmed: true,
      isAddressConfirmed: true,
      isPaymentConfirmed: true,
    };

    await expect(service.validate('customer-1', metadata)).resolves.toMatchObject({
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
          },
        ],
      },
    });
    expect(catalogReader.findAvailableFood).toHaveBeenCalledWith('food-1', 'restaurant-1');
  });

  it('rejects an address that is not owned by the current actor', async () => {
    const service = new ChatOrderValidationService(
      { findAvailableFood: jest.fn() } as never,
      { listOwnedAddresses: jest.fn().mockResolvedValue([]) } as never,
    );
    const metadata = {
      orderItems: [],
      addresses: [],
      selectedAddress: { id: 'other-address', street: 'x', ward: null, district: null, city: 'x' },
      selectedPaymentMethod: 'cod',
      isOrdering: true,
      isFoodConfirmed: true,
      isRestaurantConfirmed: true,
      isAddressConfirmed: true,
      isPaymentConfirmed: true,
    } as ChatMetadata;

    await expect(service.validate('customer-1', metadata)).resolves.toMatchObject({
      valid: false,
      action: 'chooseAddress',
    });
  });
});
