import { ForbiddenException } from '@nestjs/common';
import { FoodService } from './food.service';

describe('Food ownership characterization', () => {
  it("returns 403 when Owner A updates Owner B's food", async () => {
    const foodRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'food-b',
        restaurant: { id: 'restaurant-b', owner: { id: 'owner-b' } },
      }),
    };
    const service = new FoodService(
      foodRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.updateIfOwner('food-b', {}, 'owner-a')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
