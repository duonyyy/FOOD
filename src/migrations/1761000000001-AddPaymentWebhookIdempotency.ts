import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentWebhookIdempotency1761000000001 implements MigrationInterface {
  name = 'AddPaymentWebhookIdempotency1761000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "checkouts" ADD COLUMN IF NOT EXISTS "providerTransactionId" character varying',
    );
    await queryRunner.query(
      'ALTER TABLE "checkouts" ADD COLUMN IF NOT EXISTS "webhookIdempotencyKey" character varying',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_checkouts_payment_intent_id" ON "checkouts" ("paymentIntentId") WHERE "paymentIntentId" IS NOT NULL',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_checkouts_provider_transaction_id" ON "checkouts" ("providerTransactionId") WHERE "providerTransactionId" IS NOT NULL',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_checkouts_webhook_idempotency_key" ON "checkouts" ("webhookIdempotencyKey") WHERE "webhookIdempotencyKey" IS NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_checkouts_webhook_idempotency_key"');
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_checkouts_provider_transaction_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_checkouts_payment_intent_id"');
    await queryRunner.query('ALTER TABLE "checkouts" DROP COLUMN IF EXISTS "webhookIdempotencyKey"');
    await queryRunner.query('ALTER TABLE "checkouts" DROP COLUMN IF EXISTS "providerTransactionId"');
  }
}
