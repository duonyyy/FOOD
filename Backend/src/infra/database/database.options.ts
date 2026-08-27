import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as path from 'path';
import { DATABASE_ENTITIES } from './entity-registry';

export function createDatabaseOptions(configService: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get<string>('DB_USERNAME'),
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_NAME'),
    entities: DATABASE_ENTITIES,
    synchronize: false,
    // Migration files are timestamp-prefixed; exclude Jest *.spec.ts files.
    migrations: [path.join(__dirname, '..', '..', 'migrations', '[0-9]*{.ts,.js}')],
    migrationsRun: false,
    migrationsTableName: 'migrations',
    autoLoadEntities: false,
    retryAttempts: 1,
    retryDelay: 1000,
    maxQueryExecutionTime: 5000,
    poolSize: 3,
    extra: {
      max: 3,
      min: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },
  };
}
