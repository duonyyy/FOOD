import { CreateShipperProfiles1761000000003 } from 'src/migrations/1761000000003-CreateShipperProfiles';
import { QueryRunner } from 'typeorm';

describe('CreateShipperProfiles migration', () => {
  it('creates, backfills idempotently, and rolls back only the new projection', async () => {
    const migration = new CreateShipperProfiles1761000000003();
    const queries: string[] = [];
    const queryRunner = {
      query: jest.fn((sql: string) => {
        queries.push(sql);
      }),
    } as unknown as QueryRunner;

    await migration.up(queryRunner);
    await migration.down(queryRunner);

    expect(queries).toHaveLength(3);
    expect(queries[0]).toContain('CREATE TABLE IF NOT EXISTS "shipper_profiles"');
    expect(queries[1]).toContain('ON CONFLICT ("user_id") DO NOTHING');
    expect(queries[2]).toBe('DROP TABLE IF EXISTS "shipper_profiles"');
  });
});
