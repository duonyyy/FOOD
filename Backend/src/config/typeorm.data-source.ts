import { config } from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { DATABASE_ENTITIES } from '../infra/database/entity-registry';

config(); // Load environment variables

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: +(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: DATABASE_ENTITIES,
  // Migration files are timestamp-prefixed; exclude Jest *.spec.ts files.
  migrations: [path.join(__dirname, '..', 'migrations', '[0-9]*{.ts,.js}')],
  migrationsTableName: 'migrations',
});
