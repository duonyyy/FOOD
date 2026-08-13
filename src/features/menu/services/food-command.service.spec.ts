import { ForbiddenException } from '@nestjs/common';
import { Food } from 'src/entities/food.entity';
import { FoodCommandService } from './food-command.service';

describe('FoodCommandService', () => {
  it('uses the merchant ownership policy before updating a food', async () => {
    const ownershipPolicy = {
      assertCanManageRestaurant: jest.fn().mockRejectedValue(new ForbiddenException()),
      findRestaurant: jest.fn(),
    };
    const foodRepository = {
      findOne: jest.fn().mockResolvedValue({ restaurant: { id: 'restaurant-b' } }),
    };
    const service = new FoodCommandService(
      foodRepository as never,
      {} as never,
      ownershipPolicy,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.update('food-b', {}, 'owner-a')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(ownershipPolicy.assertCanManageRestaurant).toHaveBeenCalledWith(
      'restaurant-b',
      'owner-a',
    );
  });

  it('invalidates menu cache and removes replaced image on status-independent update', async () => {
    const food = Object.assign(new Food(), {
      id: 'food-a',
      image: 'old-image.jpg',
      imageUrls: ['old-gallery.jpg'],
      restaurant: { id: 'restaurant-a' },
      category: { id: 'category-a' },
    });
    const cache = { deleteByPattern: jest.fn().mockResolvedValue(1) };
    const storage = { deleteFile: jest.fn().mockResolvedValue(undefined) };
    const repository = {
      findOne: jest.fn().mockResolvedValue(food),
      save: jest.fn().mockImplementation((value) => Promise.resolve(value)),
    };
    const service = new FoodCommandService(
      repository as never,
      {} as never,
      {
        assertCanManageRestaurant: jest.fn().mockResolvedValue(undefined),
        findRestaurant: jest.fn(),
      },
      storage as never,
      cache as never,
      {} as never,
    );

    await service.update('food-a', { image: 'new-image.jpg', imageUrls: [] }, 'owner-a');

    expect(storage.deleteFile).toHaveBeenCalledWith('old-image.jpg');
    expect(storage.deleteFile).toHaveBeenCalledWith('old-gallery.jpg');
    expect(cache.deleteByPattern).toHaveBeenCalledWith('food:*');
  });
});
