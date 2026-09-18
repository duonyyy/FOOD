import { NotFoundException } from '@nestjs/common';
import { FoodIntegrationService } from 'src/features/menu/foods/services/food-integration.service';

describe('FoodIntegrationService', () => {
  const foodRepository = { findOne: jest.fn() };
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
});
