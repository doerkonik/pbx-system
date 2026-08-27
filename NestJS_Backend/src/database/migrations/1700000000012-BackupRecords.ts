import { MigrationInterface, QueryRunner } from 'typeorm';

/** Module 13 (Backup & System Admin): config backup catalogue. */
export class BackupRecords1700000000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "backup_records" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "fileName" varchar(200) NOT NULL,
        "type" varchar(20) NOT NULL DEFAULT 'full',
        "sizeBytes" bigint NOT NULL DEFAULT 0,
        "tableCount" int NOT NULL DEFAULT 0,
        "rowCount" int NOT NULL DEFAULT 0,
        "trigger" varchar(20) NOT NULL DEFAULT 'manual',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_backup_records" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_backup_records_createdAt" ON "backup_records" ("createdAt");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "backup_records";`);
  }
}
