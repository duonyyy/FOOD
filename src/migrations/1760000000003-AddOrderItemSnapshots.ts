import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderItemSnapshots1760000000003 implements MigrationInterface {
  name = 'AddOrderItemSnapshots1760000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "orderDetails" ADD "food_name_snapshot" character varying',
    );
    await queryRunner.query('ALTER TABLE "orderDetails" ADD "unit_price_snapshot" numeric(10,2)');
    await queryRunner.query(`
      UPDATE "orderDetails" AS detail
      SET "food_name_snapshot" = food."name",
          "unit_price_snapshot" = NULLIF(detail."price", '')::numeric
      FROM "foods" AS food
      WHERE detail."food_id" = food."id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "orderDetails" DROP COLUMN "unit_price_snapshot"');
    await queryRunner.query('ALTER TABLE "orderDetails" DROP COLUMN "food_name_snapshot"');
  }
}
