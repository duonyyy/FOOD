import { AddReviewOrderEligibilityConstraints1760000000000 } from './1760000000000-AddReviewOrderEligibilityConstraints';

describe('review order eligibility migration', () => {
  it('adds target invariant and per-order duplicate protection', async () => {
    const queries: string[] = [];
    const queryRunner = { query: jest.fn((query: string) => queries.push(query)) };
    const migration = new AddReviewOrderEligibilityConstraints1760000000000();

    await migration.up(queryRunner as never);

    expect(queries.join('\n')).toContain('"order_id" uuid');
    expect(queries.join('\n')).toContain('CHK_reviews_target_matches_type');
    expect(queries.join('\n')).toContain('UQ_reviews_food_order_customer');
    expect(queries.join('\n')).toContain('UQ_reviews_shipper_order_customer');
  });
});
