import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Module 1 (Telephony Core) inbound routing + the Supervisor role.
 *
 * Adds:
 *  - 'supervisor' to users_role_enum (irreversible — Postgres cannot drop an
 *    enum value, so down() leaves it in place).
 *  - dids, inbound_routes, time_groups, time_group_ranges, time_conditions,
 *    holidays.
 *
 * Note: `ALTER TYPE ... ADD VALUE` is safe inside a transaction on PostgreSQL
 * 12+ because the new value is not *used* in this migration.
 */
export class RoutingAndSupervisor1700000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Supervisor role --------------------------------------------------
    await queryRunner.query(
      `ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'supervisor';`,
    );

    // --- DIDs -------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "dids" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "number" varchar(40) NOT NULL,
        "description" varchar(200),
        "trunkId" uuid,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dids" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_dids_number" ON "dids" ("number");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dids_trunkId" ON "dids" ("trunkId");`,
    );

    // --- Inbound routes ---------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "inbound_routes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(80) NOT NULL,
        "didNumber" varchar(40),
        "cidPattern" varchar(80),
        "destType" varchar(40) NOT NULL,
        "destValue" varchar(120),
        "fallbackDestType" varchar(40),
        "fallbackDestValue" varchar(120),
        "priority" int NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inbound_routes" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_inbound_routes_didNumber" ON "inbound_routes" ("didNumber");`,
    );

    // --- Time groups + ranges --------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "time_groups" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(80) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_time_groups" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_time_groups_name" ON "time_groups" ("name");`,
    );

    await queryRunner.query(`
      CREATE TABLE "time_group_ranges" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "timeGroupId" uuid NOT NULL,
        "weekdayStart" int,
        "weekdayEnd" int,
        "timeStart" varchar(5),
        "timeEnd" varchar(5),
        "monthDayStart" int,
        "monthDayEnd" int,
        "monthStart" int,
        "monthEnd" int,
        CONSTRAINT "PK_time_group_ranges" PRIMARY KEY ("id"),
        CONSTRAINT "FK_time_group_ranges_group" FOREIGN KEY ("timeGroupId")
          REFERENCES "time_groups" ("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_time_group_ranges_timeGroupId" ON "time_group_ranges" ("timeGroupId");`,
    );

    // --- Time conditions --------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "time_conditions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(80) NOT NULL,
        "timeGroupId" uuid NOT NULL,
        "matchDestType" varchar(40) NOT NULL,
        "matchDestValue" varchar(120),
        "noMatchDestType" varchar(40) NOT NULL,
        "noMatchDestValue" varchar(120),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_time_conditions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_time_conditions_group" FOREIGN KEY ("timeGroupId")
          REFERENCES "time_groups" ("id") ON DELETE RESTRICT
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_time_conditions_timeGroupId" ON "time_conditions" ("timeGroupId");`,
    );

    // --- Holidays ---------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "holidays" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(80) NOT NULL,
        "date" date NOT NULL,
        "recurring" boolean NOT NULL DEFAULT false,
        "destType" varchar(40) NOT NULL,
        "destValue" varchar(120),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_holidays" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_holidays_date" ON "holidays" ("date");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "holidays";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "time_conditions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "time_group_ranges";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "time_groups";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inbound_routes";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dids";`);
    // Note: the 'supervisor' enum value cannot be removed by Postgres and is
    // intentionally left in place.
  }
}
