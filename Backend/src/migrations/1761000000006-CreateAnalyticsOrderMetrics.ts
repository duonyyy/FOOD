import { MigrationInterface, QueryRunner } from 'typeorm';

/** Analytics is rebuildable; this backfill makes the dashboard useful immediately after deploy. */
export class CreateAnalyticsOrderMetrics1761000000006 implements MigrationInterface {
  name = 'CreateAnalyticsOrderMetrics1761000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "analytics_order_metrics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "restaurant_id" varchar(100),
        "customer_id" varchar(100),
        "shipper_id" varchar(100),
        "total" numeric(12,2) NOT NULL DEFAULT 0,
        "status" varchar(50) NOT NULL DEFAULT 'pending',
        "payment_status" varchar(50),
        "payment_succeeded_at" TIMESTAMP,
        "delivery_completed_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL,
        "projected_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_analytics_order_metrics" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_analytics_order_metrics_order_id" UNIQUE ("order_id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_analytics_order_metrics_restaurant_created" ON "analytics_order_metrics" ("restaurant_id", "created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_analytics_order_metrics_status_created" ON "analytics_order_metrics" ("status", "created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_analytics_order_metrics_shipper_completed" ON "analytics_order_metrics" ("shipper_id", "delivery_completed_at")',
    );
    await queryRunner.query(`
      INSERT INTO "analytics_order_metrics" (
        "order_id", "restaurant_id", "customer_id", "shipper_id", "total", "status",
        "payment_status", "payment_succeeded_at", "delivery_completed_at", "created_at"
      )
      SELECT
        o."id", o."restaurant_id"::varchar, o."user_id"::varchar, sd."user_id"::varchar,
        COALESCE(o."total", 0), COALESCE(o."status"::varchar, 'pending'),
        checkout."status"::varchar,
        CASE WHEN checkout."status"::varchar = 'COMPLETED' THEN checkout."updatedAt" ELSE NULL END,
        sd."actualDeliveryTime", o."createdAt"
      FROM "orders" o
      LEFT JOIN "shippingDetails" sd ON sd."order_id" = o."id"
      LEFT JOIN LATERAL (
        SELECT c."status", c."updatedAt"
        FROM "checkouts" c
        WHERE c."orderId" = o."id"
        ORDER BY c."updatedAt" DESC
        LIMIT 1
      ) checkout ON TRUE
      ON CONFLICT ("order_id") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "analytics_order_metrics"');
  }
}
