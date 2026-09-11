import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the immutable customer ownership snapshot required by the Payments
 * boundary. Payments keeps only IDs and monetary snapshots; it does not import
 * Order or User persistence from another feature.
 */
export class AddCheckoutCustomerOwnership1761000000007 implements MigrationInterface {
  name = 'AddCheckoutCustomerOwnership1761000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "checkouts" ADD COLUMN IF NOT EXISTS "customerId" character varying(28)',
    );
    await queryRunner.query(`
      UPDATE "checkouts" AS checkout
      SET "customerId" = orders."user_id"::varchar
      FROM "orders" AS orders
      WHERE checkout."orderId" = orders."id"
        AND checkout."customerId" IS NULL
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_checkouts_customer_id" ON "checkouts" ("customerId")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_checkouts_customer_id"');
    await queryRunner.query('ALTER TABLE "checkouts" DROP COLUMN IF EXISTS "customerId"');
  }
}
