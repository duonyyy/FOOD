import { CreatePromotionRedemptions1760000000004 } from './1760000000004-CreatePromotionRedemptions';

describe('promotion redemption migration', () => {
  it('creates a unique, status-constrained redemption table', async () => {
    const queries: string[] = [];
    const queryRunner = { query: jest.fn((query: string) => queries.push(query)) };

    await new CreatePromotionRedemptions1760000000004().up(queryRunner as never);

    const source = queries.join('\n');
    expect(source).toContain('promotion_redemptions');
    expect(source).toContain('UQ_promotion_redemptions_order_id');
    expect(source).toContain("'committed'");
  });

  it('rolls back indexes and redemption table', async () => {
    const queries: string[] = [];
    const queryRunner = { query: jest.fn((query: string) => queries.push(query)) };

    await new CreatePromotionRedemptions1760000000004().down(queryRunner as never);

    expect(queries.at(-1)).toContain('DROP TABLE "promotion_redemptions"');
  });
});
