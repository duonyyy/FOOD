import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDeliveryEarningsProjection1761000000004 implements MigrationInterface {
  name = 'CreateDeliveryEarningsProjection1761000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "delivery_earnings_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "idempotency_key" varchar(200) NOT NULL,
        "order_id" uuid NOT NULL,
        "shipper_id" varchar(28) NOT NULL,
        "earnings" double precision NOT NULL,
        "completed_at" TIMESTAMP NOT NULL,
        "delivery_time_minutes" double precision,
        "on_time" boolean,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_delivery_earnings_events" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_delivery_earnings_events_idempotency_key" UNIQUE ("idempotency_key"),
        CONSTRAINT "UQ_delivery_earnings_events_order_id" UNIQUE ("order_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_delivery_earnings_events_shipper_id"
      ON "delivery_earnings_events" ("shipper_id")
    `);

    // Seed the immutable ledger from already completed deliveries so the new
    // projection can be rebuilt without losing historical earnings.
    await queryRunner.query(`
      INSERT INTO "delivery_earnings_events" (
        "idempotency_key", "order_id", "shipper_id", "earnings", "completed_at"
      )
      SELECT
        'legacy-delivery-completed:' || o."id"::text,
        o."id",
        sd."user_id",
        COALESCE(o."shipperEarnings", 0),
        COALESCE(sd."actualDeliveryTime", o."updatedAt", CURRENT_TIMESTAMP)
      FROM "shippingDetails" sd
      INNER JOIN "orders" o ON o."id" = sd."order_id"
      WHERE sd."status"::text = 'COMPLETED'
        AND sd."user_id" IS NOT NULL
      ON CONFLICT ("order_id") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "delivery_earnings_events"');
  }
}
