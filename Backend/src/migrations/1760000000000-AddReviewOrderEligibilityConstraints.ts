import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReviewOrderEligibilityConstraints1760000000000 implements MigrationInterface {
  name = 'AddReviewOrderEligibilityConstraints1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "reviews" ADD COLUMN "order_id" uuid');
    await queryRunner.query(
      'ALTER TABLE "reviews" ADD CONSTRAINT "FK_reviews_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "reviews" ADD CONSTRAINT "CHK_reviews_target_matches_type" CHECK (("type" = \'food\' AND "food_id" IS NOT NULL AND "shipper_id" IS NULL) OR ("type" = \'shipper\' AND "shipper_id" IS NOT NULL AND "food_id" IS NULL)) NOT VALID',
    );
    await queryRunner.query('CREATE INDEX "IDX_reviews_order_id" ON "reviews" ("order_id")');
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_reviews_food_order_customer" ON "reviews" ("order_id", "user_id", "food_id") WHERE "type" = \'food\' AND "order_id" IS NOT NULL',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_reviews_shipper_order_customer" ON "reviews" ("order_id", "user_id", "shipper_id") WHERE "type" = \'shipper\' AND "order_id" IS NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."UQ_reviews_shipper_order_customer"');
    await queryRunner.query('DROP INDEX "public"."UQ_reviews_food_order_customer"');
    await queryRunner.query('DROP INDEX "public"."IDX_reviews_order_id"');
    await queryRunner.query(
      'ALTER TABLE "reviews" DROP CONSTRAINT "CHK_reviews_target_matches_type"',
    );
    await queryRunner.query('ALTER TABLE "reviews" DROP CONSTRAINT "FK_reviews_order"');
    await queryRunner.query('ALTER TABLE "reviews" DROP COLUMN "order_id"');
  }
}
