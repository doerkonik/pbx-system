import { MigrationInterface, QueryRunner } from 'typeorm';

/** Module 2 (Call Flow): skill-based routing catalogue + assignments. */
export class Skills1700000000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "skills" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(80) NOT NULL,
        "description" varchar(200),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_skills" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_skills_name" ON "skills" ("name");`,
    );

    await queryRunner.query(`
      CREATE TABLE "agent_skills" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "extension" varchar(40) NOT NULL,
        "skillId" uuid NOT NULL,
        "level" int NOT NULL DEFAULT 3,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agent_skills" PRIMARY KEY ("id"),
        CONSTRAINT "FK_agent_skills_skill" FOREIGN KEY ("skillId")
          REFERENCES "skills" ("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_agent_skills_extension" ON "agent_skills" ("extension");`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_agent_skills_extension_skill" ON "agent_skills" ("extension", "skillId");`,
    );

    await queryRunner.query(`
      CREATE TABLE "queue_skill_requirements" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "queueName" varchar(128) NOT NULL,
        "skillId" uuid NOT NULL,
        "minLevel" int NOT NULL DEFAULT 1,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_queue_skill_requirements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_queue_skill_requirements_skill" FOREIGN KEY ("skillId")
          REFERENCES "skills" ("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_queue_skill_requirements_queueName" ON "queue_skill_requirements" ("queueName");`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_queue_skill_requirements_queue_skill" ON "queue_skill_requirements" ("queueName", "skillId");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "queue_skill_requirements";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_skills";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "skills";`);
  }
}
