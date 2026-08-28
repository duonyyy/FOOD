import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the Delivery-owned read/write model without removing legacy User
 * columns. The old columns remain during the compatibility window so existing
 * shipper commands can be migrated independently and rolled back safely.
 */
export class CreateShipperProfiles1761000000003 implements MigrationInterface {
  name = 'CreateShipperProfiles1761000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "shipper_profiles" (
        "user_id" varchar(28) NOT NULL,
        "cccd" varchar,
        "driver_license" varchar,
        "certificate_status" varchar(20) NOT NULL DEFAULT 'PENDING',
        "certificate_verified_at" TIMESTAMP,
        "is_available" boolean NOT NULL DEFAULT true,
        "max_active_deliveries" integer NOT NULL DEFAULT 3,
        "service_radius_km" double precision NOT NULL DEFAULT 10,
        "completed_deliveries" integer NOT NULL DEFAULT 0,
        "failed_deliveries" integer NOT NULL DEFAULT 0,
        "active_deliveries" integer NOT NULL DEFAULT 0,
        "average_rating" double precision NOT NULL DEFAULT 5,
        "total_ratings" integer NOT NULL DEFAULT 0,
        "average_delivery_time" double precision NOT NULL DEFAULT 0,
        "on_time_deliveries" integer NOT NULL DEFAULT 0,
        "late_deliveries" integer NOT NULL DEFAULT 0,
        "last_active_at" TIMESTAMP,
        "rejected_orders" integer NOT NULL DEFAULT 0,
        "response_time_minutes" double precision NOT NULL DEFAULT 0,
        "total_earnings" double precision NOT NULL DEFAULT 0,
        "monthly_earnings" double precision NOT NULL DEFAULT 0,
        "weekly_earnings" double precision NOT NULL DEFAULT 0,
        "daily_earnings" double precision NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shipper_profiles" PRIMARY KEY ("user_id"),
        CONSTRAINT "FK_shipper_profiles_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // Only new rows are backfilled; Delivery-owned values are never overwritten.
    await queryRunner.query(`
      INSERT INTO "shipper_profiles" (
        "user_id", "cccd", "driver_license", "certificate_status",
        "certificate_verified_at", "completed_deliveries", "failed_deliveries",
        "active_deliveries", "average_rating", "total_ratings",
        "average_delivery_time", "on_time_deliveries", "late_deliveries",
        "last_active_at", "rejected_orders", "response_time_minutes",
        "total_earnings", "monthly_earnings", "weekly_earnings", "daily_earnings"
      )
      SELECT
        u."id", c."cccd", c."driverLicense", COALESCE(c."status"::text, 'PENDING'),
        c."verifiedAt", COALESCE(u."completedDeliveries", 0), COALESCE(u."failedDeliveries", 0),
        COALESCE(u."activeDeliveries", 0), COALESCE(u."averageRating", 5), COALESCE(u."totalRatings", 0),
        COALESCE(u."averageDeliveryTime", 0), COALESCE(u."onTimeDeliveries", 0), COALESCE(u."lateDeliveries", 0),
        u."lastActiveAt", COALESCE(u."rejectedOrders", 0), COALESCE(u."responseTimeMinutes", 0),
        COALESCE(u."totalEarnings", 0), COALESCE(u."monthlyEarnings", 0),
        COALESCE(u."weeklyEarnings", 0), COALESCE(u."dailyEarnings", 0)
      FROM "users" u
      INNER JOIN "roles" r ON r."id" = u."role_id"
      LEFT JOIN "shipperCertificateInfos" c ON c."user_id" = u."id"
      WHERE r."name"::text = 'shipper'
      ON CONFLICT ("user_id") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback removes only the new projection; legacy data is untouched.
    await queryRunner.query('DROP TABLE IF EXISTS "shipper_profiles"');
  }
}
