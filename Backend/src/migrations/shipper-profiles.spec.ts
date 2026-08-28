import { CreateShipperProfiles1761000000003 } from './1761000000003-CreateShipperProfiles';

describe('CreateShipperProfiles migration', () => {
  it('creates, backfills idempotently, and rolls back only the new projection', async () => {
    const migration = new CreateShipperProfiles1761000000003();
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) } as any;

    await migration.up(queryRunner);
    await migration.down(queryRunner);

    expect(queryRunner.query).toHaveBeenCalledTimes(3);
    expect(queryRunner.query.mock.calls[0][0]).toContain(
      'CREATE TABLE IF NOT EXISTS "shipper_profiles"',
    );
    expect(queryRunner.query.mock.calls[1][0]).toContain(
      'ON CONFLICT ("user_id") DO NOTHING',
    );
    expect(queryRunner.query.mock.calls[2][0]).toBe(
      'DROP TABLE IF EXISTS "shipper_profiles"',
    );
  });
});
