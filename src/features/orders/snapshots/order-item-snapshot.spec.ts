import { createOrderItemSnapshot } from './order-item-snapshot';

describe('OrderItemSnapshot', () => {
  it('keeps the original food and topping values when the live catalog changes', () => {
    const food = { id: 'food-1', name: 'Original burger', price: 75_000 };
    const topping = { id: 'topping-1', name: 'Cheese', price: 10_000 };
    const snapshot = createOrderItemSnapshot({
      foodId: food.id,
      foodName: food.name,
      unitPrice: food.price,
      quantity: 2,
      toppings: [topping],
    });

    food.name = 'Renamed burger';
    food.price = 99_000;
    topping.name = 'Changed cheese';
    topping.price = 20_000;

    expect(snapshot).toEqual({
      foodId: 'food-1',
      foodName: 'Original burger',
      unitPrice: 75_000,
      quantity: 2,
      toppings: [{ id: 'topping-1', name: 'Cheese', price: 10_000 }],
    });
  });
});
