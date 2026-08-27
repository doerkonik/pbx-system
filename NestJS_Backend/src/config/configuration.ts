/**
 * Central, strongly-typed view of the validated environment.
 * Registered with @nestjs/config `load`; consumed everywhere via ConfigService.
 */
export interface AppConfig {
  env: string;
  port: number;
  host: string;
  corsOrigins: string[];
  logLevel: string;
}

export interface DbConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
  synchronize: boolean;
  logging: boolean;
  ssl: boolean;
}

export interface RedisConfig {
  host: string;
  port: number;
  password: string;
  db: number;
  keyPrefix: string;
}

export interface JwtConfig {
  accessSecret: string;
  accessTtl: string;
  refreshSecret: string;
  refreshTtl: string;
}

export interface ThrottleConfig {
  ttlMs: number;
  limit: number;
  authLimit: number;
}

export interface AmiConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  reconnectBaseMs: number;
  reconnectMaxMs: number;
}

export interface AriConfig {
  url: string;
  username: string;
  password: string;
  appName: string;
  reconnectBaseMs: number;
  reconnectMaxMs: number;
}

export interface RecordingConfig {
  dir: string;
  format: string;
  retentionDays: number;
  archiveDir: string;
}

export interface TelephonyBehaviourConfig {
  defaultMohClass: string;
  parkingLot: string;
  stasisApp: string;
}

export interface PasswordPolicyConfig {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
}

export interface SecurityConfig {
  passwordPolicy: PasswordPolicyConfig;
}

export interface SmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export interface RootConfig {
  app: AppConfig;
  db: DbConfig;
  redis: RedisConfig;
  jwt: JwtConfig;
  throttle: ThrottleConfig;
  ami: AmiConfig;
  ari: AriConfig;
  recording: RecordingConfig;
  telephony: TelephonyBehaviourConfig;
  security: SecurityConfig;
  smtp: SmtpConfig;
}

const bool = (v: string | undefined, def = false): boolean =>
  v === undefined ? def : ['true', '1', 'yes'].includes(v.toLowerCase());

export default (): RootConfig => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.APP_PORT ?? '3001', 10),
    host: process.env.APP_HOST ?? '0.0.0.0',
    corsOrigins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    logLevel: process.env.LOG_LEVEL ?? 'info',
  },
  db: {
    host: process.env.DB_HOST as string,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME as string,
    password: process.env.DB_PASSWORD ?? '',
    name: process.env.DB_NAME as string,
    synchronize: bool(process.env.DB_SYNCHRONIZE),
    logging: bool(process.env.DB_LOGGING),
    ssl: bool(process.env.DB_SSL),
  },
  redis: {
    host: process.env.REDIS_HOST as string,
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD ?? '',
    db: parseInt(process.env.REDIS_DB ?? '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'pbx:',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET as string,
    accessTtl: process.env.JWT_ACCESS_TTL ?? '900s',
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  throttle: {
    ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '10', 10),
    authLimit: parseInt(process.env.AUTH_THROTTLE_LIMIT ?? '5', 10),
  },
  ami: {
    host: process.env.AMI_HOST as string,
    port: parseInt(process.env.AMI_PORT ?? '5038', 10),
    username: process.env.AMI_USERNAME as string,
    password: process.env.AMI_PASSWORD as string,
    reconnectBaseMs: parseInt(process.env.AMI_RECONNECT_BASE_MS ?? '1000', 10),
    reconnectMaxMs: parseInt(process.env.AMI_RECONNECT_MAX_MS ?? '30000', 10),
  },
  ari: {
    url: process.env.ARI_URL as string,
    username: process.env.ARI_USERNAME as string,
    password: process.env.ARI_PASSWORD as string,
    appName: process.env.ARI_APP_NAME ?? 'pbx',
    reconnectBaseMs: parseInt(process.env.ARI_RECONNECT_BASE_MS ?? '1000', 10),
    reconnectMaxMs: parseInt(process.env.ARI_RECONNECT_MAX_MS ?? '30000', 10),
  },
  recording: {
    dir: process.env.RECORDING_DIR as string,
    format: process.env.RECORDING_FORMAT ?? 'wav',
    retentionDays: parseInt(process.env.RECORDING_RETENTION_DAYS ?? '90', 10),
    archiveDir: process.env.RECORDING_ARCHIVE_DIR as string,
  },
  telephony: {
    defaultMohClass: process.env.DEFAULT_MOH_CLASS ?? 'default',
    parkingLot: process.env.PARKING_LOT ?? 'default',
    stasisApp: process.env.STASIS_APP ?? 'pbx',
  },
  security: {
    passwordPolicy: {
      minLength: parseInt(process.env.PASSWORD_MIN_LENGTH ?? '8', 10),
      requireUppercase: bool(process.env.PASSWORD_REQUIRE_UPPERCASE, true),
      requireLowercase: bool(process.env.PASSWORD_REQUIRE_LOWERCASE, true),
      requireNumber: bool(process.env.PASSWORD_REQUIRE_NUMBER, true),
      requireSymbol: bool(process.env.PASSWORD_REQUIRE_SYMBOL, false),
    },
  },
  smtp: {
    enabled: bool(process.env.SMTP_ENABLED),
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: bool(process.env.SMTP_SECURE),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'PBX Suite <no-reply@pbx.local>',
  },
});
