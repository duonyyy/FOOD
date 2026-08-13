import { BadRequestException } from '@nestjs/common';
import { MenuReaderService } from './menu-reader.service';

describe('MenuReaderService', () => {
  it('returns an immutable plain snapshot with food and selected topping values', async () => {
    const foodRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'food-1',
        name: 'Phở',
        price: '55000',
        status: 'available',
        restaurant: { id: 'restaurant-1' },
        toppings: [{ id: 'topping-1', name: 'Trứng', price: '10000', isAvailable: true }],
      }),
    };
    const service = new MenuReaderService(foodRepository as never);

    const result = await service.getOrderableItems({
      items: [{ foodId: 'food-1', toppingIds: ['topping-1'] }],
    });

    expect(result[0]).toEqual({
      foodId: 'food-1',
      restaurantId: 'restaurant-1',
      name: 'Phở',
      unitPrice: 55000,
      status: 'available',
      isAvailable: true,
      toppings: [{ toppingId: 'topping-1', name: 'Trứng', unitPrice: 10000, isAvailable: true }],
    });
    expect(Object.isFrozen(result[0])).toBe(true);
    expect(Object.isFrozen(result[0].toppings)).toBe(true);
    expect(result[0]).not.toHaveProperty('restaurant');
    expect(result[0]).not.toHaveProperty('toppings[0].food');
  });

  it('captures live values at read time and does not change after the entity changes', async () => {
    const food = {
      id: 'food-1',
      name: 'Original',
      price: 10,
      status: 'available',
      restaurant: { id: 'restaurant-1' },
      toppings: [{ id: 'topping-1', name: 'Old topping', price: 2, isAvailable: true }],
    };
    const repository = { findOne: jest.fn().mockResolvedValue(food) };
    const service = new MenuReaderService(repository as never);

    const snapshot = (
      await service.getOrderableItems({
        items: [{ foodId: 'food-1', toppingIds: ['topping-1'] }],
      })
    )[0];
    food.name = 'Changed';
    food.price = 99;
    food.toppings[0].name = 'Changed topping';
    food.toppings[0].price = 77;

    expect(snapshot.name).toBe('Original');
    expect(snapshot.unitPrice).toBe(10);
    expect(snapshot.toppings[0].name).toBe('Old topping');
    expect(snapshot.toppings[0].unitPrice).toBe(2);
  });

  it('rejects a topping that does not belong to the requested food', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'food-1',
        price: 10,
        status: 'available',
        restaurant: { id: 'restaurant-1' },
        toppings: [],
      }),
    };
    const service = new MenuReaderService(repository as never);

    await expect(
      service.getOrderableItems({ items: [{ foodId: 'food-1', toppingIds: ['other'] }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
