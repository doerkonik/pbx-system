import { MigrationInterface, QueryRunner } from 'typeorm';

/** Module 12 (Notifications & Communication): notifications + direct messages. */
export class Comms1700000000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid,
        "type" varchar(40) NOT NULL DEFAULT 'info',
        "title" varchar(150) NOT NULL,
        "body" text,
        "link" varchar(200),
        "readAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_userId" ON "notifications" ("userId");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_createdAt" ON "notifications" ("createdAt");`,
    );

    await queryRunner.query(`
      CREATE TABLE "direct_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "fromUserId" uuid NOT NULL,
        "toUserId" uuid NOT NULL,
        "body" text NOT NULL,
        "readAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_direct_messages" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_direct_messages_fromUserId" ON "direct_messages" ("fromUserId");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_direct_messages_toUserId" ON "direct_messages" ("toUserId");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_direct_messages_to_read" ON "direct_messages" ("toUserId", "readAt");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_direct_messages_createdAt" ON "direct_messages" ("createdAt");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "direct_messages";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications";`);
  }
}
