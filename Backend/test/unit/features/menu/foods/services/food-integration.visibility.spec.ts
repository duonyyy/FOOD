import { FoodIntegrationService } from 'src/features/menu/foods/services/food-integration.service';

describe('FoodIntegrationService orderability', () => {
  it.each(['pending', 'rejected'])(
    'does not make an available food orderable when its restaurant is %s',
    async (restaurantStatus) => {
      const foodRepository = {
        findOne: jest.fn().mockResolvedValue({
          id: 'food-1',
          name: 'Phở',
          price: 55_000,
          status: 'available',
          restaurant: { id: 'restaurant-1', status: restaurantStatus },
          toppings: [],
        }),
      };
      const service = new FoodIntegrationService(foodRepository as never);

      const [snapshot] = await service.getOrderableItems({
        items: [{ foodId: 'food-1', toppingIds: [] }],
      });

      expect(snapshot?.isAvailable).toBe(false);
    },
  );
});
