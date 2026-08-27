import { MigrationInterface, QueryRunner } from 'typeorm';

/** Module 9 (Quality Assurance): forms, questions, evaluations, scores, notes. */
export class Qa1700000000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "qa_forms" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(120) NOT NULL,
        "description" varchar(300),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_qa_forms" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_qa_forms_name" ON "qa_forms" ("name");`,
    );

    await queryRunner.query(`
      CREATE TABLE "qa_questions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "formId" uuid NOT NULL,
        "section" varchar(120),
        "text" varchar(400) NOT NULL,
        "maxScore" int NOT NULL DEFAULT 5,
        "weight" int NOT NULL DEFAULT 1,
        "sortOrder" int NOT NULL DEFAULT 0,
        CONSTRAINT "PK_qa_questions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_qa_questions_form" FOREIGN KEY ("formId")
          REFERENCES "qa_forms" ("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_qa_questions_formId" ON "qa_questions" ("formId");`,
    );

    await queryRunner.query(`
      CREATE TABLE "qa_evaluations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "formId" uuid NOT NULL,
        "uniqueid" varchar(150) NOT NULL,
        "agentExtension" varchar(40),
        "agentId" uuid,
        "evaluatorId" uuid NOT NULL,
        "assignedById" uuid,
        "status" varchar(20) NOT NULL DEFAULT 'assigned',
        "totalScore" int NOT NULL DEFAULT 0,
        "maxScore" int NOT NULL DEFAULT 0,
        "scorePct" numeric(5,2) NOT NULL DEFAULT 0,
        "summary" text,
        "completedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_qa_evaluations" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_qa_evaluations_uniqueid" ON "qa_evaluations" ("uniqueid");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qa_evaluations_agentExtension" ON "qa_evaluations" ("agentExtension");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_qa_evaluations_evaluator_status" ON "qa_evaluations" ("evaluatorId", "status");`,
    );

    await queryRunner.query(`
      CREATE TABLE "qa_scores" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "evaluationId" uuid NOT NULL,
        "questionId" uuid NOT NULL,
        "score" int NOT NULL DEFAULT 0,
        "comment" varchar(500),
        CONSTRAINT "PK_qa_scores" PRIMARY KEY ("id"),
        CONSTRAINT "FK_qa_scores_evaluation" FOREIGN KEY ("evaluationId")
          REFERENCES "qa_evaluations" ("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_qa_scores_eval_question" ON "qa_scores" ("evaluationId", "questionId");`,
    );

    await queryRunner.query(`
      CREATE TABLE "call_notes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "uniqueid" varchar(150) NOT NULL,
        "authorId" uuid NOT NULL,
        "note" text NOT NULL,
        "tags" jsonb NOT NULL DEFAULT '[]',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_call_notes" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_call_notes_uniqueid" ON "call_notes" ("uniqueid");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_call_notes_createdAt" ON "call_notes" ("createdAt");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "call_notes";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "qa_scores";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "qa_evaluations";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "qa_questions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "qa_forms";`);
  }
}
