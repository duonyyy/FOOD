import { OrderPricingService } from './order-pricing.service';

describe('OrderPricingService', () => {
  const service = new OrderPricingService();

  it.each([
    {
      name: 'discount and toppings',
      input: {
        items: [
          {
            foodId: 'food-1',
            unitPrice: 100_000,
            discountPercent: 10,
            quantity: 2,
            toppings: [{ id: 'topping-1', unitPrice: 5_000 }],
          },
        ],
        shippingFee: 20_000,
        promotionDiscount: 15_000,
      },
      expected: { foodTotal: 190_000, subtotal: 210_000, total: 195_000 },
    },
    {
      name: 'multiple lines',
      input: {
        items: [
          {
            foodId: 'food-1',
            unitPrice: 50_000,
            discountPercent: 0,
            quantity: 1,
            toppings: [],
          },
          {
            foodId: 'food-2',
            unitPrice: 30_000,
            discountPercent: 50,
            quantity: 3,
            toppings: [{ id: 'topping-2', unitPrice: 2_000 }],
          },
        ],
        shippingFee: 10_000,
        promotionDiscount: 0,
      },
      expected: { foodTotal: 101_000, subtotal: 111_000, total: 111_000 },
    },
  ])('$name', ({ input, expected }) => {
    expect(service.calculate(input)).toMatchObject(expected);
  });

  it('clamps invalid discount, shipping, and promotion values safely', () => {
    expect(
      service.calculate({
        items: [
          {
            foodId: 'food-1',
            unitPrice: 100,
            discountPercent: 150,
            quantity: 1,
            toppings: [],
          },
        ],
        shippingFee: -20,
        promotionDiscount: 500,
      }),
    ).toEqual({
      foodTotal: 0,
      shippingFee: 0,
      subtotal: 0,
      promotionDiscount: 0,
      total: 0,
    });
  });

  it('does not read a client-provided total and does not mutate snapshots', () => {
    const input: {
      items: Array<{
        foodId: string;
        unitPrice: number;
        discountPercent: number;
        quantity: number;
        toppings: Array<{ id: string; unitPrice: number }>;
      }>;
      shippingFee: number;
      promotionDiscount: number;
      total: number;
    } = {
      items: [
        {
          foodId: 'food-1',
          unitPrice: 100,
          discountPercent: 0,
          quantity: 2,
          toppings: [],
        },
      ],
      shippingFee: 10,
      promotionDiscount: 0,
      total: 1,
    };

    expect(service.calculate(input)).toMatchObject({ total: 210 });
    expect(input.items[0].unitPrice).toBe(100);
  });
});
