import { MigrationInterface, QueryRunner } from 'typeorm';

/** AI Studio: add voice + telephony (dial config) fields to the config row. */
export class AiAgentControl1700000000015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_agent_config"
        ADD COLUMN IF NOT EXISTS "voice" varchar(60) NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS "aiExten" varchar(20) NOT NULL DEFAULT '8888',
        ADD COLUMN IF NOT EXISTS "press3Agents" varchar(200) NOT NULL DEFAULT '102&103',
        ADD COLUMN IF NOT EXISTS "ringSeconds" int NOT NULL DEFAULT 5,
        ADD COLUMN IF NOT EXISTS "recordCalls" boolean NOT NULL DEFAULT true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_agent_config"
        DROP COLUMN IF EXISTS "voice",
        DROP COLUMN IF EXISTS "aiExten",
        DROP COLUMN IF EXISTS "press3Agents",
        DROP COLUMN IF EXISTS "ringSeconds",
        DROP COLUMN IF EXISTS "recordCalls";
    `);
  }
}
