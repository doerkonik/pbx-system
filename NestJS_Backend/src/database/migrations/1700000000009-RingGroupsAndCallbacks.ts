import { MigrationInterface, QueryRunner } from 'typeorm';

/** Module 2 (Call Flow): ring groups + queue callbacks. */
export class RingGroupsAndCallbacks1700000000009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ring_groups" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "number" varchar(40) NOT NULL,
        "name" varchar(80) NOT NULL,
        "strategy" varchar(20) NOT NULL DEFAULT 'ringall',
        "memberExtensions" jsonb NOT NULL DEFAULT '[]',
        "ringTimeSec" int NOT NULL DEFAULT 20,
        "noAnswerDestType" varchar(40) NOT NULL DEFAULT 'hangup',
        "noAnswerDestValue" varchar(120),
        "callerIdPrefix" varchar(40),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ring_groups" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ring_groups_number" ON "ring_groups" ("number");`,
    );

    await queryRunner.query(`
      CREATE TABLE "queue_callbacks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "queueName" varchar(128) NOT NULL,
        "phone" varchar(40) NOT NULL,
        "callerName" varchar(120),
        "priority" int NOT NULL DEFAULT 0,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "attempts" int NOT NULL DEFAULT 0,
        "lastAttemptAt" timestamptz,
        "lastUniqueid" varchar(150),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_queue_callbacks" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_queue_callbacks_queueName" ON "queue_callbacks" ("queueName");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_queue_callbacks_queue_status" ON "queue_callbacks" ("queueName", "status");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "queue_callbacks";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ring_groups";`);
  }
}
