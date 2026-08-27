import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Module 6 (Supervisor & Monitoring): per-queue SLA thresholds + the alert log
 * opened/closed by the periodic SLA evaluator.
 */
export class Monitoring1700000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "sla_thresholds" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "queueName" varchar(128) NOT NULL,
        "maxWaitSec" int NOT NULL DEFAULT 60,
        "maxCallsWaiting" int NOT NULL DEFAULT 10,
        "minAvailableAgents" int NOT NULL DEFAULT 1,
        "serviceLevelTargetSec" int NOT NULL DEFAULT 20,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sla_thresholds" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_sla_thresholds_queueName" ON "sla_thresholds" ("queueName");`,
    );

    await queryRunner.query(`
      CREATE TABLE "monitoring_alerts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "queueName" varchar(128) NOT NULL,
        "type" varchar(40) NOT NULL,
        "severity" varchar(20) NOT NULL DEFAULT 'warning',
        "message" varchar(200) NOT NULL,
        "value" int NOT NULL DEFAULT 0,
        "threshold" int NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "resolvedAt" timestamptz,
        CONSTRAINT "PK_monitoring_alerts" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_monitoring_alerts_queueName" ON "monitoring_alerts" ("queueName");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_monitoring_alerts_createdAt" ON "monitoring_alerts" ("createdAt");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "monitoring_alerts";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sla_thresholds";`);
  }
}
