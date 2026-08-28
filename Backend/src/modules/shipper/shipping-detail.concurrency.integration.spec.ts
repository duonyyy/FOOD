import AppDataSource from 'src/config/typeorm.data-source';
import { DataSource } from 'typeorm';

jest.setTimeout(30_000);

const postgresIntegration =
  process.env.FOODEE_RUN_POSTGRES_INTEGRATION === '1' ? describe : describe.skip;

postgresIntegration('ShippingDetail PostgreSQL concurrency contract', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = AppDataSource;
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('allows only one concurrent ShippingDetail for an order', async () => {
    const uniqueIndexes = await dataSource.query(`
      SELECT indexdef
      FROM pg_indexes
      WHERE tablename = 'shippingDetails'
        AND indexdef ILIKE '%UNIQUE%'
        AND indexdef ILIKE '%order_id%'
    `);

    expect(uniqueIndexes).not.toHaveLength(0);

    const availableOrders = await dataSource.query(`
      SELECT o.id
      FROM orders o
      WHERE NOT EXISTS (
        SELECT 1
        FROM "shippingDetails" sd
        WHERE sd.order_id = o.id
      )
      LIMIT 1
    `);
    expect(availableOrders).not.toHaveLength(0);

    const orderId = availableOrders[0].id;
    const firstRunner = dataSource.createQueryRunner();
    const secondRunner = dataSource.createQueryRunner();
    const insertedIds: string[] = [];

    try {
      await Promise.all([firstRunner.connect(), secondRunner.connect()]);

      const insert = `
        INSERT INTO "shippingDetails" ("order_id")
        VALUES ($1)
        RETURNING id
      `;
      const results = await Promise.allSettled([
        firstRunner.query(insert, [orderId]),
        secondRunner.query(insert, [orderId]),
      ]);

      const fulfilled = results.filter(
        (result): result is PromiseFulfilledResult<Array<{ id: string }>> =>
          result.status === 'fulfilled',
      );
      const rejected = results.filter((result) => result.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason.code).toBe('23505');

      insertedIds.push(fulfilled[0].value[0].id);
    } finally {
      if (insertedIds.length > 0) {
        await dataSource.query(
          `DELETE FROM "shippingDetails" WHERE id = ANY($1::uuid[])`,
          [insertedIds],
        );
      }
      await Promise.all([firstRunner.release(), secondRunner.release()]);
    }
  });
});
