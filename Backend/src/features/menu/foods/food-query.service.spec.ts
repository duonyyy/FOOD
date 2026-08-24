import { FoodQueryService } from './food-query.service';

describe('FoodQueryService', () => {
  it('builds the user menu from Food ownership data without a Restaurant repository', async () => {
    const foodRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'food-a',
          name: 'Burger',
          price: 10,
          description: 'Classic',
          image: 'burger.jpg',
          restaurant: { id: 'restaurant-a', name: 'Store A', address: { city: 'HCMC' } },
        },
        {
          id: 'food-b',
          name: 'Fries',
          price: 4,
          description: 'Crispy',
          image: 'fries.jpg',
          restaurant: { id: 'restaurant-a', name: 'Store A', address: { city: 'HCMC' } },
        },
      ]),
    };
    const cache = { remember: jest.fn(), deleteByPattern: jest.fn() };
    const service = new FoodQueryService(
      foodRepository as never,
      {} as never,
      {} as never,
      { findRestaurant: jest.fn() } as never,
      cache as never,
      { getDistanceAndDuration: jest.fn() } as never,
    );

    await expect(service.getMenuForUser('user-a')).resolves.toEqual([
      {
        id: 'restaurant-a',
        name: 'Store A',
        address: { city: 'HCMC' },
        foods: [
          {
            id: 'food-a',
            name: 'Burger',
            price: 10,
            description: 'Classic',
            image: 'burger.jpg',
            restaurantId: 'restaurant-a',
          },
          {
            id: 'food-b',
            name: 'Fries',
            price: 4,
            description: 'Crispy',
            image: 'fries.jpg',
            restaurantId: 'restaurant-a',
          },
        ],
      },
    ]);
  });
});
