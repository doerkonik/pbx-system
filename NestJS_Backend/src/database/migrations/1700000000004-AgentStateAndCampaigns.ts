import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Module 5 (Agent Management) remaining: hot-desking, DND/ACW presence, and the
 * preview outbound dialer.
 *
 * Adds:
 *  - 'acw' + 'dnd' to agent_status_log_status_enum (forward-compat for logging).
 *  - agent_sessions.deviceExtension (hot-desking).
 *  - agent_preferences (persisted DND).
 *  - campaigns + campaign_contacts.
 */
export class AgentStateAndCampaigns1700000000004
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Presence enum values --------------------------------------------
    await queryRunner.query(
      `ALTER TYPE "agent_status_log_status_enum" ADD VALUE IF NOT EXISTS 'acw';`,
    );
    await queryRunner.query(
      `ALTER TYPE "agent_status_log_status_enum" ADD VALUE IF NOT EXISTS 'dnd';`,
    );

    // --- Hot-desking ------------------------------------------------------
    await queryRunner.query(
      `ALTER TABLE "agent_sessions" ADD COLUMN IF NOT EXISTS "deviceExtension" varchar(40);`,
    );

    // --- Agent preferences (DND) -----------------------------------------
    await queryRunner.query(`
      CREATE TABLE "agent_preferences" (
        "agentId" uuid NOT NULL,
        "dnd" boolean NOT NULL DEFAULT false,
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agent_preferences" PRIMARY KEY ("agentId")
      );
    `);

    // --- Campaigns --------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "campaigns" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(120) NOT NULL,
        "mode" varchar(20) NOT NULL DEFAULT 'preview',
        "callerId" varchar(80),
        "status" varchar(20) NOT NULL DEFAULT 'draft',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_campaigns" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "campaign_contacts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "campaignId" uuid NOT NULL,
        "phone" varchar(40) NOT NULL,
        "name" varchar(120),
        "attributes" jsonb NOT NULL DEFAULT '{}',
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "attempts" int NOT NULL DEFAULT 0,
        "assignedAgentId" uuid,
        "lastUniqueid" varchar(150),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_campaign_contacts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_campaign_contacts_campaign" FOREIGN KEY ("campaignId")
          REFERENCES "campaigns" ("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_campaign_contacts_campaignId" ON "campaign_contacts" ("campaignId");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_campaign_contacts_campaign_status" ON "campaign_contacts" ("campaignId", "status");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "campaign_contacts";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "campaigns";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_preferences";`);
    await queryRunner.query(
      `ALTER TABLE "agent_sessions" DROP COLUMN IF EXISTS "deviceExtension";`,
    );
    // Note: enum values 'acw'/'dnd' cannot be removed by Postgres and are left.
  }
}
