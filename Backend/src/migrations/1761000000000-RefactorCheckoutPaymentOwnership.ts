import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Payments owns checkout lifecycle. Checkout retains only an order reference
 * and server-authoritative monetary snapshot; it must not own User or Order
 * relations, nor persist signed provider redirect URLs.
 */
export class RefactorCheckoutPaymentOwnership1761000000000 implements MigrationInterface {
  name = 'RefactorCheckoutPaymentOwnership1761000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "checkouts" DROP COLUMN IF EXISTS "userId"');
    await queryRunner.query('ALTER TABLE "checkouts" DROP COLUMN IF EXISTS "paymentUrl"');
    await queryRunner.query(
      'ALTER TABLE "checkouts" ALTER COLUMN "paymentIntentId" TYPE character varying USING "paymentIntentId"::text',
    );
    await queryRunner.query(
      'ALTER TABLE "checkouts" ADD COLUMN IF NOT EXISTS "currency" character varying(3) NOT NULL DEFAULT \'VND\'',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "checkouts" DROP COLUMN IF EXISTS "currency"');
    await queryRunner.query(
      "ALTER TABLE \"checkouts\" ALTER COLUMN \"paymentIntentId\" TYPE uuid USING CASE WHEN \"paymentIntentId\" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN \"paymentIntentId\"::uuid ELSE NULL END",
    );
    await queryRunner.query('ALTER TABLE "checkouts" ADD COLUMN IF NOT EXISTS "paymentUrl" character varying');
    await queryRunner.query('ALTER TABLE "checkouts" ADD COLUMN IF NOT EXISTS "userId" character varying(28)');
  }
}
