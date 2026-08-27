import { config as loadEnv } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ALL_ENTITIES } from './entities';

// Loaded for the TypeORM CLI (migrations/seed) which runs outside Nest DI.
loadEnv();

const bool = (v: string | undefined, def = false): boolean =>
  v === undefined ? def : ['true', '1', 'yes'].includes(v.toLowerCase());

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: ALL_ENTITIES,
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: bool(process.env.DB_SYNCHRONIZE),
  logging: bool(process.env.DB_LOGGING),
  ssl: bool(process.env.DB_SSL) ? { rejectUnauthorized: false } : false,
};

/** Used by the TypeORM CLI. Nest itself configures TypeOrmModule separately. */
const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
