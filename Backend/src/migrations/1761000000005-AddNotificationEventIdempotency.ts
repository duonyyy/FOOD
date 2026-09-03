import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationEventIdempotency1761000000005 implements MigrationInterface {
  name = 'AddNotificationEventIdempotency1761000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(200)',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_notifications_idempotency_key" ON "notifications" ("idempotency_key")',
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_dead_letters" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "idempotency_key" varchar(200) NOT NULL,
        "event_type" varchar(150) NOT NULL,
        "recipient_user_id" varchar(100) NOT NULL,
        "payload" jsonb NOT NULL,
        "attempts" integer NOT NULL DEFAULT 1,
        "last_error" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_dead_letters" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_dead_letters_idempotency_key" UNIQUE ("idempotency_key")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "notification_dead_letters"');
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_notifications_idempotency_key"');
    await queryRunner.query('ALTER TABLE "notifications" DROP COLUMN IF EXISTS "idempotency_key"');
  }
}
