import { Promotion } from 'src/entities/promotion.entity';
import {
  calculatePromotionDiscount,
  checkPromotionRules,
} from 'src/features/promotions/contracts/promotion-rules.policy';

describe('promotion rules policy', () => {
  const promotion = (overrides: Partial<Promotion> = {}): Promotion =>
    ({
      code: 'WELCOME',
      numberOfUsed: 0,
      discountPercent: 10,
      ...overrides,
    }) as Promotion;

  it('accepts an active promotion that satisfies the minimum order value', () => {
    expect(checkPromotionRules(promotion({ minOrderValue: 100_000 }), 150_000)).toEqual({
      valid: true,
    });
  });

  it('rejects expired and exhausted promotions', () => {
    expect(
      checkPromotionRules(promotion({ endDate: new Date(Date.now() - 1_000) }), 100_000),
    ).toMatchObject({ valid: false, reason: 'Promotion has expired' });

    expect(checkPromotionRules(promotion({ maxUsage: 2, numberOfUsed: 2 }), 100_000)).toMatchObject(
      {
        valid: false,
        reason: 'Promotion usage limit reached',
      },
    );
  });

  it('caps percentage discounts and never exceeds the order amount', () => {
    expect(
      calculatePromotionDiscount(
        promotion({ discountPercent: 50, maxDiscountAmount: 20_000 }),
        100_000,
      ),
    ).toBe(20_000);

    expect(
      calculatePromotionDiscount(
        promotion({ discountPercent: undefined, discountAmount: 200_000 }),
        100_000,
      ),
    ).toBe(100_000);
  });
});
