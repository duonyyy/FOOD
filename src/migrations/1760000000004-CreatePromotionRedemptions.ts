import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePromotionRedemptions1760000000004 implements MigrationInterface {
  name = 'CreatePromotionRedemptions1760000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "promotion_redemptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "promotion_id" uuid NOT NULL,
        "promotion_code" character varying(100) NOT NULL,
        "discount_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "status" character varying(16) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_promotion_redemptions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_promotion_redemptions_order_id" UNIQUE ("order_id"),
        CONSTRAINT "CHK_promotion_redemptions_status" CHECK ("status" IN ('reserved', 'committed', 'released')),
        CONSTRAINT "FK_promotion_redemptions_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_promotion_redemptions_customer" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_promotion_redemptions_promotion" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_promotion_redemptions_promotion_id" ON "promotion_redemptions" ("promotion_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_promotion_redemptions_customer_id" ON "promotion_redemptions" ("customer_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_promotion_redemptions_customer_id"');
    await queryRunner.query('DROP INDEX "public"."IDX_promotion_redemptions_promotion_id"');
    await queryRunner.query('DROP TABLE "promotion_redemptions"');
  }
}
