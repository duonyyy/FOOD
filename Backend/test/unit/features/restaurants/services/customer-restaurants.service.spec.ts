import { RestaurantStatus } from 'src/entities/restaurant.entity';
import { CustomerRestaurantsService } from 'src/features/restaurants/services/customer-restaurants.service';

describe('CustomerRestaurantsService snapshots', () => {
  const repository = { findOne: jest.fn(), find: jest.fn() };
  const service = new CustomerRestaurantsService(repository as never);

  beforeEach(() => jest.clearAllMocks());

  it('requires an approved restaurant for order creation and converts its location', async () => {
    repository.findOne.mockResolvedValue({
      id: 'restaurant-1',
      status: RestaurantStatus.APPROVED,
      owner: { id: 'owner-1' },
      address: { latitude: '10.5', longitude: '106.7' },
    });

    await expect(service.findActiveRestaurant('restaurant-1')).resolves.toEqual({
      restaurantId: 'restaurant-1',
      ownerId: 'owner-1',
      isActive: true,
      location: { latitude: 10.5, longitude: 106.7 },
    });
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'restaurant-1', status: RestaurantStatus.APPROVED },
      relations: ['owner', 'address'],
    });
  });

  it('keeps the existing pending restaurant chat snapshot marked inactive', async () => {
    repository.findOne.mockResolvedValue({
      id: 'restaurant-2',
      name: 'Quán chờ duyệt',
      status: RestaurantStatus.PENDING,
      owner: { id: 'owner-2' },
    });

    await expect(service.findRestaurantForMessaging('restaurant-2')).resolves.toEqual({
      restaurantId: 'restaurant-2',
      ownerId: 'owner-2',
      name: 'Quán chờ duyệt',
      isActive: false,
    });
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'restaurant-2' },
      relations: ['owner'],
    });
  });

  it('keeps numeric location for Menu without returning Restaurant entity', async () => {
    repository.findOne.mockResolvedValue({
      id: 'restaurant-1',
      latitude: '10.5',
      longitude: '106.7',
    });

    await expect(service.findRestaurant('restaurant-1')).resolves.toEqual({
      restaurantId: 'restaurant-1',
      latitude: 10.5,
      longitude: 106.7,
    });
  });
});
