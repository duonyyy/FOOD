import { ForbiddenException } from '@nestjs/common';
import { FoodCommandService } from '../../features/menu/services/food-command.service';

describe('Food ownership characterization', () => {
  it("returns 403 when Owner A updates Owner B's food", async () => {
    const foodRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'food-b',
        restaurant: { id: 'restaurant-b', owner: { id: 'owner-b' } },
      }),
    };
    const service = new FoodCommandService(
      foodRepository as never,
      {} as never,
      {
        assertCanManageRestaurant: jest.fn().mockRejectedValue(new ForbiddenException()),
        findRestaurant: jest.fn(),
      },
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.update('food-b', {}, 'owner-a')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
