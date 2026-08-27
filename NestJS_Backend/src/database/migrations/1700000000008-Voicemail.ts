import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Module 2 (Call Flow): Asterisk `app_voicemail` realtime table. Column names
 * follow app_voicemail's realtime schema; Asterisk owns reads once
 * `voicemail => pgsql,pbx,voicemail` is added to extconfig.conf.
 */
export class Voicemail1700000000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "voicemail" (
        "uniqueid" SERIAL NOT NULL,
        "context" varchar(80) NOT NULL DEFAULT 'default',
        "mailbox" varchar(80) NOT NULL,
        "password" varchar(80) NOT NULL,
        "fullname" varchar(150),
        "email" varchar(150),
        "pager" varchar(150),
        "attach" varchar(5) NOT NULL DEFAULT 'no',
        "attachfmt" varchar(10) DEFAULT 'wav',
        "deletevoicemail" int NOT NULL DEFAULT 0,
        "saycid" varchar(5) NOT NULL DEFAULT 'no',
        "tz" varchar(40),
        "maxmsg" int DEFAULT 100,
        CONSTRAINT "PK_voicemail" PRIMARY KEY ("uniqueid")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_voicemail_mailbox" ON "voicemail" ("mailbox");`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_voicemail_context_mailbox" ON "voicemail" ("context", "mailbox");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "voicemail";`);
  }
}
