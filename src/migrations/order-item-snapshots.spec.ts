import { AddOrderItemSnapshots1760000000003 } from './1760000000003-AddOrderItemSnapshots';

describe('order item snapshot migration', () => {
  it('adds and backfills immutable item values', async () => {
    const queries: string[] = [];
    const queryRunner = { query: jest.fn((query: string) => queries.push(query)) };

    await new AddOrderItemSnapshots1760000000003().up(queryRunner as never);

    const source = queries.join('\n');
    expect(source).toContain('food_name_snapshot');
    expect(source).toContain('unit_price_snapshot');
    expect(source).toContain('UPDATE "orderDetails"');
    expect(source).toContain('FROM "foods"');
  });

  it('can roll back both snapshot columns', async () => {
    const queries: string[] = [];
    const queryRunner = { query: jest.fn((query: string) => queries.push(query)) };

    await new AddOrderItemSnapshots1760000000003().down(queryRunner as never);

    expect(queries.join('\n')).toContain('DROP COLUMN "unit_price_snapshot"');
    expect(queries.join('\n')).toContain('DROP COLUMN "food_name_snapshot"');
  });
});
