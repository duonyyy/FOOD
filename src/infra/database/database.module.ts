import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [__dirname + '/../../entities/*.entity{.ts,.js}'],
        synchronize: false,
        migrations: [__dirname + '/../../migrations/*{.ts,.js}'],
        migrationsRun: false,
        migrationsTableName: 'migrations',
        autoLoadEntities: true,
        keepConnectionAlive: false,
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
      }),
    }),
  ],
})
export class DatabaseModule {}
