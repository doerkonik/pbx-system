import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema. Creates every table, enum type, index and foreign key
 * defined by the TypeORM entities (see src/database/entities/*).
 *
 * Enum type names follow TypeORM's default `${table}_${column}_enum` naming
 * (column part lowercased) so a later `synchronize` check won't try to rename
 * them. Raw SQL is used for explicitness and readability.
 */
export class InitialSchema1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // gen_random_uuid() lives in pgcrypto.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    // ---------------------------------------------------------------------
    // Enum types
    // ---------------------------------------------------------------------
    await queryRunner.query(
      `CREATE TYPE "users_role_enum" AS ENUM ('admin', 'agent');`,
    );
    await queryRunner.query(
      `CREATE TYPE "trunks_authtype_enum" AS ENUM ('registration', 'ip');`,
    );
    await queryRunner.query(
      `CREATE TYPE "blacklist_direction_enum" AS ENUM ('inbound', 'outbound', 'both');`,
    );
    await queryRunner.query(
      `CREATE TYPE "recordings_scope_enum" AS ENUM ('extension', 'queue', 'trunk', 'global');`,
    );
    await queryRunner.query(
      `CREATE TYPE "misc_destinations_type_enum" AS ENUM ('external_number', 'announcement', 'hangup');`,
    );
    await queryRunner.query(
      `CREATE TYPE "ivr_menus_invaliddesttype_enum" AS ENUM ('extension', 'queue', 'ivr', 'misc_destination', 'voicemail', 'hangup');`,
    );
    await queryRunner.query(
      `CREATE TYPE "ivr_entries_desttype_enum" AS ENUM ('extension', 'queue', 'ivr', 'misc_destination', 'voicemail', 'hangup');`,
    );
    await queryRunner.query(
      `CREATE TYPE "queue_config_strategy_enum" AS ENUM ('ringall', 'leastrecent', 'fewestcalls', 'random', 'rrmemory', 'linear', 'wrandom');`,
    );
    await queryRunner.query(
      `CREATE TYPE "agent_status_log_status_enum" AS ENUM ('idle', 'ringing', 'in_call', 'on_hold', 'paused', 'offline');`,
    );
    await queryRunner.query(
      `CREATE TYPE "agent_status_log_reason_enum" AS ENUM ('lunch', 'rest', 'meeting', 'training', 'admin', 'other');`,
    );

    // ---------------------------------------------------------------------
    // PJSIP realtime tables
    // ---------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "ps_aors" (
        "id" varchar(40) NOT NULL,
        "contact" varchar(255),
        "max_contacts" int DEFAULT 1,
        "remove_existing" varchar(5) DEFAULT 'yes',
        "qualify_frequency" int DEFAULT 60,
        "authenticate_qualify" varchar(5),
        "maximum_expiration" int,
        "minimum_expiration" int,
        "default_expiration" int,
        "mailboxes" varchar(80),
        "support_path" varchar(5),
        CONSTRAINT "PK_ps_aors" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "ps_auths" (
        "id" varchar(40) NOT NULL,
        "auth_type" varchar(20) DEFAULT 'userpass',
        "password" varchar(80),
        "username" varchar(40),
        "realm" varchar(40),
        "md5_cred" varchar(40),
        "nonce_lifetime" int,
        CONSTRAINT "PK_ps_auths" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "ps_endpoints" (
        "id" varchar(40) NOT NULL,
        "transport" varchar(40) DEFAULT 'transport-wss',
        "aors" varchar(200),
        "auth" varchar(40),
        "context" varchar(40) DEFAULT 'from-internal',
        "disallow" varchar(200) DEFAULT '!all,ulaw,alaw,opus',
        "allow" varchar(200) DEFAULT 'ulaw,alaw,opus',
        "direct_media" varchar(5) DEFAULT 'no',
        "callerid" varchar(80),
        "dtmf_mode" varchar(10) DEFAULT 'rfc4733',
        "force_rport" varchar(5) DEFAULT 'yes',
        "rewrite_contact" varchar(5) DEFAULT 'yes',
        "rtp_symmetric" varchar(5) DEFAULT 'yes',
        "ice_support" varchar(5) DEFAULT 'no',
        "webrtc" varchar(5) DEFAULT 'no',
        "use_avpf" varchar(5),
        "media_encryption" varchar(10),
        "dtls_auto_generate_cert" varchar(5),
        "rtcp_mux" varchar(5),
        "mailboxes" varchar(80),
        "call_group" varchar(40),
        "pickup_group" varchar(40),
        "named_call_group" varchar(40),
        "device_state_busy_at" int,
        "allow_subscribe" varchar(5),
        CONSTRAINT "PK_ps_endpoints" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "ps_endpoint_id_ips" (
        "id" varchar(40) NOT NULL,
        "endpoint" varchar(40) NOT NULL,
        "match" varchar(80) NOT NULL,
        "srv_lookups" varchar(5) DEFAULT 'yes',
        "match_header" varchar(255),
        CONSTRAINT "PK_ps_endpoint_id_ips" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "ps_registrations" (
        "id" varchar(40) NOT NULL,
        "transport" varchar(40) DEFAULT 'transport-udp',
        "outbound_auth" varchar(40),
        "server_uri" varchar(255) NOT NULL,
        "client_uri" varchar(255) NOT NULL,
        "contact_user" varchar(40),
        "retry_interval" int DEFAULT 60,
        "forbidden_retry_interval" int DEFAULT 600,
        "expiration" int DEFAULT 3600,
        "max_retries" int DEFAULT 10,
        "auth_rejection_permanent" varchar(5) DEFAULT 'no',
        "line" varchar(40),
        "endpoint" varchar(40),
        CONSTRAINT "PK_ps_registrations" PRIMARY KEY ("id")
      );
    `);

    // ---------------------------------------------------------------------
    // Asterisk data tables
    // ---------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "queues" (
        "name" varchar(128) NOT NULL,
        "musiconhold" varchar(128) DEFAULT 'default',
        "strategy" varchar(128),
        "timeout" int DEFAULT 15,
        "wrapuptime" int DEFAULT 0,
        "maxlen" int,
        "ringinuse" varchar(5) DEFAULT 'yes',
        "retry" int,
        "announce_frequency" int DEFAULT 5,
        "joinempty" varchar(128),
        "leavewhenempty" varchar(128),
        "memberdelay" int DEFAULT 5,
        "weight" int DEFAULT 1,
        CONSTRAINT "PK_queues" PRIMARY KEY ("name")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "queue_members" (
        "uniqueid" SERIAL NOT NULL,
        "queue_name" varchar(128) NOT NULL,
        "interface" varchar(255) NOT NULL,
        "membername" varchar(128),
        "state_interface" varchar(255),
        "penalty" int DEFAULT 0,
        "paused" int DEFAULT 0,
        "wrapuptime" int DEFAULT 1,
        CONSTRAINT "PK_queue_members" PRIMARY KEY ("uniqueid")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_queue_members_queue_name" ON "queue_members" ("queue_name");`,
    );

    await queryRunner.query(`
      CREATE TABLE "cdr" (
        "id" SERIAL NOT NULL,
        "calldate" timestamptz,
        "clid" varchar(80) NOT NULL DEFAULT '',
        "src" varchar(80) NOT NULL DEFAULT '',
        "dst" varchar(80) NOT NULL DEFAULT '',
        "dcontext" varchar(80) NOT NULL DEFAULT '',
        "channel" varchar(80) NOT NULL DEFAULT '',
        "dstchannel" varchar(80) NOT NULL DEFAULT '',
        "lastapp" varchar(80) NOT NULL DEFAULT '',
        "lastdata" varchar(80) NOT NULL DEFAULT '',
        "duration" int NOT NULL DEFAULT 0,
        "billsec" int NOT NULL DEFAULT 0,
        "disposition" varchar(45) NOT NULL DEFAULT '',
        "amaflags" int NOT NULL DEFAULT 0,
        "accountcode" varchar(80) NOT NULL DEFAULT '',
        "uniqueid" varchar(150) NOT NULL DEFAULT '',
        "linkedid" varchar(150) NOT NULL DEFAULT '',
        "userfield" varchar(80) NOT NULL DEFAULT '',
        "peeraccount" varchar(80) NOT NULL DEFAULT '',
        "sequence" int NOT NULL DEFAULT 0,
        CONSTRAINT "PK_cdr" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_cdr_calldate" ON "cdr" ("calldate");`);
    await queryRunner.query(`CREATE INDEX "IDX_cdr_src" ON "cdr" ("src");`);
    await queryRunner.query(`CREATE INDEX "IDX_cdr_dst" ON "cdr" ("dst");`);
    await queryRunner.query(`CREATE INDEX "IDX_cdr_disposition" ON "cdr" ("disposition");`);
    await queryRunner.query(`CREATE INDEX "IDX_cdr_uniqueid" ON "cdr" ("uniqueid");`);

    await queryRunner.query(`
      CREATE TABLE "queue_log" (
        "id" SERIAL NOT NULL,
        "time" timestamptz NOT NULL,
        "callid" varchar(80) NOT NULL DEFAULT '',
        "queuename" varchar(128) NOT NULL DEFAULT '',
        "agent" varchar(128) NOT NULL DEFAULT '',
        "event" varchar(80) NOT NULL DEFAULT '',
        "data1" varchar(80) NOT NULL DEFAULT '',
        "data2" varchar(80) NOT NULL DEFAULT '',
        "data3" varchar(80) NOT NULL DEFAULT '',
        "data4" varchar(80) NOT NULL DEFAULT '',
        "data5" varchar(80) NOT NULL DEFAULT '',
        CONSTRAINT "PK_queue_log" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_queue_log_time" ON "queue_log" ("time");`);
    await queryRunner.query(`CREATE INDEX "IDX_queue_log_callid" ON "queue_log" ("callid");`);
    await queryRunner.query(`CREATE INDEX "IDX_queue_log_queuename" ON "queue_log" ("queuename");`);
    await queryRunner.query(`CREATE INDEX "IDX_queue_log_event" ON "queue_log" ("event");`);

    // ---------------------------------------------------------------------
    // Operational tables
    // ---------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "username" varchar(64) NOT NULL,
        "email" varchar(120),
        "fullName" varchar(120),
        "passwordHash" varchar(255) NOT NULL,
        "refreshTokenHash" varchar(255),
        "role" "users_role_enum" NOT NULL DEFAULT 'agent',
        "isActive" boolean NOT NULL DEFAULT true,
        "extension" varchar(40),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_username" ON "users" ("username");`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_users_extension" ON "users" ("extension");`);

    await queryRunner.query(`
      CREATE TABLE "extensions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "extensionNumber" varchar(40) NOT NULL,
        "displayName" varchar(120),
        "department" varchar(80),
        "webrtc" boolean NOT NULL DEFAULT false,
        "recordingEnabled" boolean NOT NULL DEFAULT false,
        "callGroup" varchar(128),
        "pickupGroup" varchar(128),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_extensions" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_extensions_extensionNumber" ON "extensions" ("extensionNumber");`,
    );

    await queryRunner.query(`
      CREATE TABLE "trunks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(40) NOT NULL,
        "authType" "trunks_authtype_enum" NOT NULL DEFAULT 'registration',
        "sipServer" varchar(255) NOT NULL,
        "sipPort" int NOT NULL DEFAULT 5060,
        "username" varchar(120),
        "password" varchar(120),
        "matchIp" varchar(80),
        "codecs" varchar(200),
        "failoverOrder" int NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trunks" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_trunks_name" ON "trunks" ("name");`,
    );

    await queryRunner.query(`
      CREATE TABLE "outbound_routes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(80) NOT NULL,
        "pattern" varchar(120) NOT NULL,
        "prefix" varchar(40),
        "stripDigits" int NOT NULL DEFAULT 0,
        "callerIdOverride" varchar(80),
        "priority" int NOT NULL DEFAULT 0,
        "trunkIds" jsonb NOT NULL DEFAULT '[]',
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_outbound_routes" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "blacklist" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "number" varchar(40) NOT NULL,
        "direction" "blacklist_direction_enum" NOT NULL DEFAULT 'both',
        "reason" varchar(200),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_blacklist" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_blacklist_number" ON "blacklist" ("number");`);

    await queryRunner.query(`
      CREATE TABLE "recordings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "uniqueid" varchar(150) NOT NULL,
        "linkedid" varchar(80),
        "src" varchar(80),
        "dst" varchar(80),
        "scope" "recordings_scope_enum" NOT NULL DEFAULT 'global',
        "filePath" varchar(512) NOT NULL,
        "format" varchar(16) NOT NULL DEFAULT 'wav',
        "fileSizeBytes" bigint,
        "durationSec" int,
        "archived" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recordings" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_recordings_uniqueid" ON "recordings" ("uniqueid");`);
    await queryRunner.query(`CREATE INDEX "IDX_recordings_createdAt" ON "recordings" ("createdAt");`);

    await queryRunner.query(`
      CREATE TABLE "call_forwarding" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "extensionNumber" varchar(40) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT false,
        "forwardTo" varchar(80),
        "forwardType" varchar(20) NOT NULL DEFAULT 'unconditional',
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_call_forwarding" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_call_forwarding_extensionNumber" ON "call_forwarding" ("extensionNumber");`,
    );

    await queryRunner.query(`
      CREATE TABLE "misc_destinations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(80) NOT NULL,
        "type" "misc_destinations_type_enum" NOT NULL,
        "value" varchar(200),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_misc_destinations" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "moh_classes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(80) NOT NULL,
        "mode" varchar(20) NOT NULL DEFAULT 'files',
        "directory" varchar(512) NOT NULL,
        "format" varchar(20) NOT NULL DEFAULT 'wav',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_moh_classes" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_moh_classes_name" ON "moh_classes" ("name");`,
    );

    await queryRunner.query(`
      CREATE TABLE "moh_files" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "mohClassId" uuid NOT NULL,
        "fileName" varchar(200) NOT NULL,
        "filePath" varchar(512) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_moh_files" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "ivr_menus" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(80) NOT NULL,
        "greetingSound" varchar(200) NOT NULL,
        "digitTimeoutSec" int NOT NULL DEFAULT 5,
        "maxRetries" int NOT NULL DEFAULT 3,
        "invalidDestType" "ivr_menus_invaliddesttype_enum" NOT NULL DEFAULT 'hangup',
        "invalidDestValue" varchar(120),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ivr_menus" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ivr_menus_name" ON "ivr_menus" ("name");`,
    );

    await queryRunner.query(`
      CREATE TABLE "ivr_entries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "menuId" uuid NOT NULL,
        "digit" varchar(8) NOT NULL,
        "destType" "ivr_entries_desttype_enum" NOT NULL,
        "destValue" varchar(120),
        "label" varchar(120),
        CONSTRAINT "PK_ivr_entries" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "queue_config" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(128) NOT NULL,
        "displayName" varchar(120),
        "strategy" "queue_config_strategy_enum" NOT NULL DEFAULT 'rrmemory',
        "mohClass" varchar(80) NOT NULL DEFAULT 'default',
        "timeout" int NOT NULL DEFAULT 15,
        "wrapupTime" int NOT NULL DEFAULT 0,
        "maxWait" int,
        "overflowDestType" varchar(40),
        "overflowDestValue" varchar(120),
        "recordingEnabled" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_queue_config" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_queue_config_name" ON "queue_config" ("name");`,
    );

    await queryRunner.query(`
      CREATE TABLE "conferences" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "roomNumber" varchar(40) NOT NULL,
        "name" varchar(120) NOT NULL,
        "pin" varchar(40),
        "adminPin" varchar(40),
        "recordingEnabled" boolean NOT NULL DEFAULT true,
        "mohClass" varchar(80) NOT NULL DEFAULT 'default',
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conferences" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_conferences_roomNumber" ON "conferences" ("roomNumber");`,
    );

    // ---------------------------------------------------------------------
    // Reporting tables
    // ---------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "agent_status_log" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "agentId" uuid NOT NULL,
        "extension" varchar(40) NOT NULL,
        "status" "agent_status_log_status_enum" NOT NULL,
        "reason" "agent_status_log_reason_enum",
        "startedAt" timestamptz NOT NULL,
        "endedAt" timestamptz,
        "durationSec" int,
        CONSTRAINT "PK_agent_status_log" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_agent_status_log_agentId" ON "agent_status_log" ("agentId");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_agent_status_log_startedAt" ON "agent_status_log" ("startedAt");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_agent_status_log_agentId_startedAt" ON "agent_status_log" ("agentId", "startedAt");`,
    );

    await queryRunner.query(`
      CREATE TABLE "agent_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "agentId" uuid NOT NULL,
        "extension" varchar(40) NOT NULL,
        "loginAt" timestamptz NOT NULL,
        "logoutAt" timestamptz,
        "durationSec" int,
        CONSTRAINT "PK_agent_sessions" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_agent_sessions_agentId" ON "agent_sessions" ("agentId");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_agent_sessions_agentId_loginAt" ON "agent_sessions" ("agentId", "loginAt");`,
    );

    await queryRunner.query(`
      CREATE TABLE "daily_agent_stats" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "statDate" date NOT NULL,
        "agentId" uuid NOT NULL,
        "extension" varchar(40) NOT NULL,
        "callsHandled" int NOT NULL DEFAULT 0,
        "callsAnswered" int NOT NULL DEFAULT 0,
        "callsMissed" int NOT NULL DEFAULT 0,
        "totalTalkSec" int NOT NULL DEFAULT 0,
        "totalHoldSec" int NOT NULL DEFAULT 0,
        "loginSec" int NOT NULL DEFAULT 0,
        "pauseSec" int NOT NULL DEFAULT 0,
        "avgHandleSec" int NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_daily_agent_stats" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_daily_agent_stats_statDate_agentId" UNIQUE ("statDate", "agentId")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_daily_agent_stats_statDate" ON "daily_agent_stats" ("statDate");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_daily_agent_stats_agentId" ON "daily_agent_stats" ("agentId");`,
    );

    await queryRunner.query(`
      CREATE TABLE "daily_queue_stats" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "statDate" date NOT NULL,
        "queueName" varchar(128) NOT NULL,
        "offered" int NOT NULL DEFAULT 0,
        "answered" int NOT NULL DEFAULT 0,
        "abandoned" int NOT NULL DEFAULT 0,
        "totalWaitSec" int NOT NULL DEFAULT 0,
        "maxWaitSec" int NOT NULL DEFAULT 0,
        "totalTalkSec" int NOT NULL DEFAULT 0,
        "avgWaitSec" int NOT NULL DEFAULT 0,
        "avgTalkSec" int NOT NULL DEFAULT 0,
        "serviceLevelPct" numeric(5,2) NOT NULL DEFAULT '0',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_daily_queue_stats" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_daily_queue_stats_statDate_queueName" UNIQUE ("statDate", "queueName")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_daily_queue_stats_statDate" ON "daily_queue_stats" ("statDate");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_daily_queue_stats_queueName" ON "daily_queue_stats" ("queueName");`,
    );

    // ---------------------------------------------------------------------
    // Foreign keys
    // ---------------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "moh_files"
        ADD CONSTRAINT "FK_moh_files_mohClass"
        FOREIGN KEY ("mohClassId") REFERENCES "moh_classes" ("id")
        ON DELETE CASCADE ON UPDATE NO ACTION;
    `);
    await queryRunner.query(`
      ALTER TABLE "ivr_entries"
        ADD CONSTRAINT "FK_ivr_entries_menu"
        FOREIGN KEY ("menuId") REFERENCES "ivr_menus" ("id")
        ON DELETE CASCADE ON UPDATE NO ACTION;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Foreign keys
    await queryRunner.query(`ALTER TABLE "ivr_entries" DROP CONSTRAINT "FK_ivr_entries_menu";`);
    await queryRunner.query(`ALTER TABLE "moh_files" DROP CONSTRAINT "FK_moh_files_mohClass";`);

    // Tables (reverse dependency order)
    await queryRunner.query(`DROP TABLE "daily_queue_stats";`);
    await queryRunner.query(`DROP TABLE "daily_agent_stats";`);
    await queryRunner.query(`DROP TABLE "agent_sessions";`);
    await queryRunner.query(`DROP TABLE "agent_status_log";`);
    await queryRunner.query(`DROP TABLE "conferences";`);
    await queryRunner.query(`DROP TABLE "queue_config";`);
    await queryRunner.query(`DROP TABLE "ivr_entries";`);
    await queryRunner.query(`DROP TABLE "ivr_menus";`);
    await queryRunner.query(`DROP TABLE "moh_files";`);
    await queryRunner.query(`DROP TABLE "moh_classes";`);
    await queryRunner.query(`DROP TABLE "misc_destinations";`);
    await queryRunner.query(`DROP TABLE "call_forwarding";`);
    await queryRunner.query(`DROP TABLE "recordings";`);
    await queryRunner.query(`DROP TABLE "blacklist";`);
    await queryRunner.query(`DROP TABLE "outbound_routes";`);
    await queryRunner.query(`DROP TABLE "trunks";`);
    await queryRunner.query(`DROP TABLE "extensions";`);
    await queryRunner.query(`DROP TABLE "users";`);
    await queryRunner.query(`DROP TABLE "queue_log";`);
    await queryRunner.query(`DROP TABLE "cdr";`);
    await queryRunner.query(`DROP TABLE "queue_members";`);
    await queryRunner.query(`DROP TABLE "queues";`);
    await queryRunner.query(`DROP TABLE "ps_registrations";`);
    await queryRunner.query(`DROP TABLE "ps_endpoint_id_ips";`);
    await queryRunner.query(`DROP TABLE "ps_endpoints";`);
    await queryRunner.query(`DROP TABLE "ps_auths";`);
    await queryRunner.query(`DROP TABLE "ps_aors";`);

    // Enum types
    await queryRunner.query(`DROP TYPE "agent_status_log_reason_enum";`);
    await queryRunner.query(`DROP TYPE "agent_status_log_status_enum";`);
    await queryRunner.query(`DROP TYPE "queue_config_strategy_enum";`);
    await queryRunner.query(`DROP TYPE "ivr_entries_desttype_enum";`);
    await queryRunner.query(`DROP TYPE "ivr_menus_invaliddesttype_enum";`);
    await queryRunner.query(`DROP TYPE "misc_destinations_type_enum";`);
    await queryRunner.query(`DROP TYPE "recordings_scope_enum";`);
    await queryRunner.query(`DROP TYPE "blacklist_direction_enum";`);
    await queryRunner.query(`DROP TYPE "trunks_authtype_enum";`);
    await queryRunner.query(`DROP TYPE "users_role_enum";`);
  }
}
