import { CreateCatalogNameConstraints1760000000002 } from './1760000000002-CreateCatalogNameConstraints';

describe('Catalog name constraints migration', () => {
  it('creates normalized unique indexes without touching order snapshots', async () => {
    const queries: string[] = [];
    const queryRunner = { query: jest.fn(async (sql: string) => queries.push(sql)) };
    const migration = new CreateCatalogNameConstraints1760000000002();

    await migration.up(queryRunner as never);

    expect(queries[0]).toContain('IDX_categories_name_normalized');
    expect(queries[1]).toContain('IDX_toppings_food_name_normalized');
    expect(queries.join('\n')).not.toContain('orderDetails');
    expect(queries.join('\n')).not.toContain('selected_toppings');
  });
});
