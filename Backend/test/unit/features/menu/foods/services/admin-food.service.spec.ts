import { Food } from 'src/entities/food.entity';
import { AdminFoodService } from 'src/features/menu/foods/services/admin-food.service';

describe('AdminFoodService', () => {
  it('deletes food, removes media and invalidates cache on admin override', async () => {
    const food = Object.assign(new Food(), {
      id: 'food-violation',
      image: 'violation.jpg',
      imageUrls: ['v1.jpg'],
      restaurant: { id: 'restaurant-x' },
      category: { id: 'category-y' },
    });

    const foodRepository = {
      findOne: jest.fn().mockResolvedValue(food),
      remove: jest.fn().mockResolvedValue(food),
    };
    const storage = { deleteFile: jest.fn().mockResolvedValue(undefined) };
    const cache = { deleteByPattern: jest.fn().mockResolvedValue(1) };

    const service = new AdminFoodService(foodRepository as never, storage as never, cache as never);

    await service.deleteByAdmin('food-violation');

    expect(foodRepository.remove).toHaveBeenCalledWith(food);
    expect(storage.deleteFile).toHaveBeenCalledWith('violation.jpg');
    expect(storage.deleteFile).toHaveBeenCalledWith('v1.jpg');
    expect(cache.deleteByPattern).toHaveBeenCalledWith('food:food-violation:*');
    expect(cache.deleteByPattern).toHaveBeenCalledWith('restaurant:restaurant-x:*');
  });
});
