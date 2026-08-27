import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentReconciliationState1761000000002 implements MigrationInterface {
  name = 'AddPaymentReconciliationState1761000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "checkouts" ADD COLUMN IF NOT EXISTS "reconciliation_attempts" integer NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE "checkouts" ADD COLUMN IF NOT EXISTS "reconciliation_last_attempt_at" timestamp',
    );
    await queryRunner.query(
      'ALTER TABLE "checkouts" ADD COLUMN IF NOT EXISTS "reconciliation_last_error" text',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "checkouts" DROP COLUMN IF EXISTS "reconciliation_last_error"',
    );
    await queryRunner.query(
      'ALTER TABLE "checkouts" DROP COLUMN IF EXISTS "reconciliation_last_attempt_at"',
    );
    await queryRunner.query(
      'ALTER TABLE "checkouts" DROP COLUMN IF EXISTS "reconciliation_attempts"',
    );
  }
}
