import { MigrationInterface, QueryRunner } from 'typeorm';

/** AI call transcripts + auto-CSAT reviews (one row per AI-handled call). */
export class AiCallReview1700000000016 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ai_call_review" (
        "uniqueid" varchar(150) NOT NULL,
        "caller" varchar(80) NOT NULL DEFAULT '',
        "transcript" text,
        "csatScore" int,
        "csatLabel" varchar(20),
        "summary" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_call_review" PRIMARY KEY ("uniqueid")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_call_review_createdAt" ON "ai_call_review" ("createdAt");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_call_review";`);
  }
}
