import { MigrationInterface, QueryRunner } from 'typeorm';

/** Module 10 (Security): config-change audit trail. */
export class AuditLogs1700000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid,
        "username" varchar(64),
        "role" varchar(20),
        "method" varchar(10) NOT NULL,
        "path" varchar(200) NOT NULL,
        "action" varchar(20) NOT NULL,
        "resource" varchar(80),
        "resourceId" varchar(150),
        "statusCode" int,
        "ip" varchar(64),
        "meta" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_userId" ON "audit_logs" ("userId");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_path" ON "audit_logs" ("path");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_resource" ON "audit_logs" ("resource");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_createdAt" ON "audit_logs" ("createdAt");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs";`);
  }
}
