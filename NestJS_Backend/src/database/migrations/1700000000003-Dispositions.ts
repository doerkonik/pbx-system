import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Module 5 (Agent Management): call-disposition / wrap-up codes.
 * Adds disposition_codes (admin taxonomy) and call_dispositions (per-call
 * agent submissions, one per uniqueid+agent).
 */
export class Dispositions1700000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "disposition_codes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" varchar(40) NOT NULL,
        "label" varchar(120) NOT NULL,
        "category" varchar(40) NOT NULL DEFAULT 'other',
        "requiresNote" boolean NOT NULL DEFAULT false,
        "sortOrder" int NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_disposition_codes" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_disposition_codes_code" ON "disposition_codes" ("code");`,
    );

    await queryRunner.query(`
      CREATE TABLE "call_dispositions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "uniqueid" varchar(150) NOT NULL,
        "linkedid" varchar(150),
        "agentId" uuid NOT NULL,
        "extension" varchar(40),
        "dispositionCodeId" uuid NOT NULL,
        "note" text,
        "acwSec" int,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_call_dispositions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_call_dispositions_code" FOREIGN KEY ("dispositionCodeId")
          REFERENCES "disposition_codes" ("id") ON DELETE RESTRICT
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_call_dispositions_uniqueid" ON "call_dispositions" ("uniqueid");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_call_dispositions_agentId" ON "call_dispositions" ("agentId");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_call_dispositions_createdAt" ON "call_dispositions" ("createdAt");`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_call_dispositions_uniqueid_agentId" ON "call_dispositions" ("uniqueid", "agentId");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "call_dispositions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "disposition_codes";`);
  }
}
