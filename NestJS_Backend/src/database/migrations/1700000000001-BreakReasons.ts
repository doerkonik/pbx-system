import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Make break reasons admin-configurable:
 *  - new `break_reasons` table (seeded with the former enum values),
 *  - `agent_status_log.reason` becomes free-form varchar so any configured code
 *    can be stored (and the fixed enum type is dropped).
 */
export class BreakReasons1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "break_reasons" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" varchar(40) NOT NULL,
        "label" varchar(80) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "sortOrder" int NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_break_reasons" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_break_reasons_code" ON "break_reasons" ("code");`,
    );

    // Seed with the reasons that were previously hardcoded in the enum.
    await queryRunner.query(`
      INSERT INTO "break_reasons" ("code","label","sortOrder") VALUES
        ('lunch','Lunch',1),
        ('rest','Rest / Short Break',2),
        ('meeting','Meeting',3),
        ('training','Training',4),
        ('admin','Administrative',5),
        ('other','Other',6)
      ON CONFLICT ("code") DO NOTHING;
    `);

    // agent_status_log.reason: enum -> varchar, then drop the now-unused type.
    await queryRunner.query(
      `ALTER TABLE "agent_status_log" ALTER COLUMN "reason" TYPE varchar(64) USING "reason"::text;`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "agent_status_log_reason_enum";`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reason stays varchar on rollback (safe); just drop the config table.
    await queryRunner.query(`DROP TABLE IF EXISTS "break_reasons";`);
  }
}
