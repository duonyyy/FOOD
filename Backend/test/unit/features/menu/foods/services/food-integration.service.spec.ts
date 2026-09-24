import { NotFoundException } from '@nestjs/common';
import { FoodIntegrationService } from 'src/features/menu/foods/services/food-integration.service';

describe('FoodIntegrationService', () => {
  const foodRepository = { find: jest.fn(), findOne: jest.fn() };
  const service = new FoodIntegrationService(foodRepository as never);

  beforeEach(() => jest.clearAllMocks());

  it('keeps the food existence check inside Menu without returning a food snapshot', async () => {
    foodRepository.findOne.mockResolvedValue({ id: 'food-1' });

    await expect(service.assertFoodExists('food-1')).resolves.toBeUndefined();
    expect(foodRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'food-1' },
      select: ['id'],
    });
  });

  it('reports a missing food through the owner feature', async () => {
    foodRepository.findOne.mockResolvedValue(null);

    await expect(service.assertFoodExists('food-missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns available restaurant previews with numeric price and rating', async () => {
    foodRepository.find.mockResolvedValue([
      { id: 'food-1', name: 'Soup', image: null, price: '50000', rating: '4.50', soldCount: 8 },
    ]);

    await expect(service.listRestaurantFoods('restaurant-1', 2, 5)).resolves.toEqual([
      {
        foodId: 'food-1',
        name: 'Soup',
        image: null,
        price: 50000,
        rating: 4.5,
        soldCount: 8,
      },
    ]);
    expect(foodRepository.find).toHaveBeenCalledWith({
      where: { restaurant: { id: 'restaurant-1' }, status: 'available' },
      order: { soldCount: 'DESC' },
      skip: 5,
      take: 5,
    });
  });

  it('excludes unapproved restaurants from chat catalog snapshots', async () => {
    const approved = {
      id: 'food-1',
      name: 'Soup',
      price: '50000',
      restaurant: { id: 'restaurant-1', name: 'Store', status: 'approved' },
    };
    const pending = {
      ...approved,
      id: 'food-2',
      restaurant: { id: 'restaurant-2', name: 'Pending', status: 'pending' },
    };
    foodRepository.find.mockResolvedValue([approved, pending]);
    foodRepository.findOne.mockResolvedValue(pending);

    await expect(service.listAvailableFoods()).resolves.toEqual([
      {
        foodId: 'food-1',
        restaurantId: 'restaurant-1',
        restaurantName: 'Store',
        name: 'Soup',
        description: null,
        image: null,
        price: 50000,
      },
    ]);
    await expect(service.findAvailableFood('food-2')).resolves.toBeNull();
    expect(foodRepository.find).toHaveBeenCalledWith({
      where: { status: 'available' },
      relations: ['restaurant'],
      order: { name: 'ASC' },
    });
  });
});
