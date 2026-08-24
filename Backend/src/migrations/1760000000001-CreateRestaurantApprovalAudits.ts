import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRestaurantApprovalAudits1760000000001 implements MigrationInterface {
  name = 'CreateRestaurantApprovalAudits1760000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "restaurant_approval_audits" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "restaurant_id" uuid NOT NULL,
        "actor_user_id" uuid NOT NULL,
        "action" character varying(16) NOT NULL,
        "reason" character varying(500),
        "previous_status" character varying(16) NOT NULL,
        "next_status" character varying(16) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_restaurant_approval_audits" PRIMARY KEY ("id"),
        CONSTRAINT "FK_restaurant_approval_audits_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "CHK_restaurant_approval_audits_action" CHECK ("action" IN ('approved', 'rejected')),
        CONSTRAINT "CHK_restaurant_approval_audits_transition" CHECK (
          "previous_status" = 'pending' AND
          (("action" = 'approved' AND "next_status" = 'approved') OR
           ("action" = 'rejected' AND "next_status" = 'rejected'))
        )
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_restaurant_approval_audits_restaurant_id" ON "restaurant_approval_audits" ("restaurant_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_restaurant_approval_audits_actor_user_id" ON "restaurant_approval_audits" ("actor_user_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_restaurant_approval_audits_actor_user_id"');
    await queryRunner.query('DROP INDEX "public"."IDX_restaurant_approval_audits_restaurant_id"');
    await queryRunner.query('DROP TABLE "restaurant_approval_audits"');
  }
}
