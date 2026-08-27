import * as Joi from 'joi';

/**
 * Startup validation for every environment variable the backend depends on.
 * The process refuses to boot if any required value is missing or malformed,
 * so we never get silent runtime failures from an un-set secret or host.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  APP_PORT: Joi.number().port().default(3001),
  APP_HOST: Joi.string().default('0.0.0.0'),
  CORS_ORIGINS: Joi.string().required(),
  LOG_LEVEL: Joi.string()
    .valid('trace', 'debug', 'info', 'warn', 'error', 'fatal')
    .default('info'),

  // PostgreSQL
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_NAME: Joi.string().required(),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),
  DB_SSL: Joi.boolean().default(false),

  // Redis
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_DB: Joi.number().min(0).default(0),
  REDIS_KEY_PREFIX: Joi.string().default('pbx:'),

  // JWT
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TTL: Joi.string().default('900s'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_TTL: Joi.string().default('7d'),

  // Throttling
  THROTTLE_TTL_MS: Joi.number().default(60000),
  THROTTLE_LIMIT: Joi.number().default(10),
  AUTH_THROTTLE_LIMIT: Joi.number().default(5),

  // AMI
  AMI_HOST: Joi.string().required(),
  AMI_PORT: Joi.number().port().default(5038),
  AMI_USERNAME: Joi.string().required(),
  AMI_PASSWORD: Joi.string().required(),
  AMI_RECONNECT_BASE_MS: Joi.number().default(1000),
  AMI_RECONNECT_MAX_MS: Joi.number().default(30000),

  // ARI
  ARI_URL: Joi.string().uri().required(),
  ARI_USERNAME: Joi.string().required(),
  ARI_PASSWORD: Joi.string().required(),
  ARI_APP_NAME: Joi.string().default('pbx'),
  ARI_RECONNECT_BASE_MS: Joi.number().default(1000),
  ARI_RECONNECT_MAX_MS: Joi.number().default(30000),

  // Recording
  RECORDING_DIR: Joi.string().required(),
  RECORDING_FORMAT: Joi.string().valid('wav', 'gsm', 'ulaw', 'alaw').default('wav'),
  RECORDING_RETENTION_DAYS: Joi.number().default(90),
  RECORDING_ARCHIVE_DIR: Joi.string().required(),

  // Telephony behaviour
  DEFAULT_MOH_CLASS: Joi.string().default('default'),
  PARKING_LOT: Joi.string().default('default'),
  STASIS_APP: Joi.string().default('pbx'),
});
