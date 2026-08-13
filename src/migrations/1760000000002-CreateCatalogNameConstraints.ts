import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCatalogNameConstraints1760000000002 implements MigrationInterface {
  name = 'CreateCatalogNameConstraints1760000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_categories_name_normalized" ON "categories" (LOWER(TRIM("name"))) WHERE "name" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_toppings_food_name_normalized" ON "toppings" ("food_id", LOWER(TRIM("name"))) WHERE "name" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_toppings_food_name_normalized"`);
    await queryRunner.query(`DROP INDEX "IDX_categories_name_normalized"`);
  }
}
