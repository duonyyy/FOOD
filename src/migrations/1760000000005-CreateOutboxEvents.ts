import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOutboxEvents1760000000005 implements MigrationInterface {
  name = 'CreateOutboxEvents1760000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "outbox_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_type" character varying(150) NOT NULL,
        "aggregate_type" character varying(100) NOT NULL,
        "aggregate_id" uuid NOT NULL,
        "idempotency_key" character varying(200) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "available_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "last_error" text,
        "published_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_outbox_events" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_outbox_events_idempotency_key" UNIQUE ("idempotency_key"),
        CONSTRAINT "CHK_outbox_events_status" CHECK ("status" IN ('pending', 'failed', 'published'))
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_outbox_events_dispatch" ON "outbox_events" ("status", "available_at", "created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_outbox_events_aggregate" ON "outbox_events" ("aggregate_type", "aggregate_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_outbox_events_aggregate"');
    await queryRunner.query('DROP INDEX "public"."IDX_outbox_events_dispatch"');
    await queryRunner.query('DROP TABLE "outbox_events"');
  }
}
