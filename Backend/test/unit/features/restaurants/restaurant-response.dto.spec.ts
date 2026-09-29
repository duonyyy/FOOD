import { Restaurant, RestaurantStatus } from 'src/entities/restaurant.entity';
import { RestaurantResponseDto } from 'src/features/restaurants/dto/restaurant-response.dto';

describe('RestaurantResponseDto', () => {
  it('preserves owner, nullable fields and decimal conversion', () => {
    const restaurant = {
      id: 'restaurant-1',
      name: 'Quán thử nghiệm',
      status: RestaurantStatus.APPROVED,
      rating: '4.5',
      owner: { id: 'owner-1' },
      address: {
        id: 'address-1',
        street: '1 Đường A',
        latitude: '10.5',
        longitude: '106.7',
      },
      distance: 2.3,
      deliveryTime: 12,
    } as unknown as Restaurant & { distance: number; deliveryTime: number };

    expect(RestaurantResponseDto.fromRestaurant(restaurant)).toEqual({
      id: 'restaurant-1',
      name: 'Quán thử nghiệm',
      phoneNumber: null,
      avatar: null,
      backgroundImage: null,
      description: null,
      openTime: null,
      closeTime: null,
      rating: 4.5,
      status: RestaurantStatus.APPROVED,
      ownerId: 'owner-1',
      address: {
        id: 'address-1',
        street: '1 Đường A',
        ward: null,
        district: null,
        city: null,
        latitude: 10.5,
        longitude: 106.7,
      },
      distance: 2.3,
      deliveryTime: 12,
    });
  });
});
