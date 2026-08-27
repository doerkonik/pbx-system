import { MigrationInterface, QueryRunner } from 'typeorm';

/** AI voice-agent studio: single-row configuration for the AVR/Gemini agent. */
export class AiAgentConfig1700000000014 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ai_agent_config" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "agentName" varchar(120) NOT NULL DEFAULT 'Assistant',
        "organizationName" varchar(160) NOT NULL DEFAULT '',
        "businessDescription" text,
        "language" varchar(20) NOT NULL DEFAULT 'bn',
        "allowEnglish" boolean NOT NULL DEFAULT true,
        "personality" text,
        "businessFacts" text,
        "fallbackBehavior" text,
        "greeting" text,
        "model" varchar(120) NOT NULL DEFAULT 'gemini-2.5-flash-native-audio-preview-12-2025',
        "compiledInstructions" text,
        "published" boolean NOT NULL DEFAULT false,
        "lastPublishedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_agent_config" PRIMARY KEY ("id")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_agent_config";`);
  }
}
