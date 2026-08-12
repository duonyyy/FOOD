import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ScheduleModule } from '@nestjs/schedule';
import { Request } from 'express';
import { EventsModule } from '../../common/events/events.module';
import { HttpContractModule } from '../../common/http-contract/http-contract.module';
import { RequestContextModule } from '../../common/request-context/request-context.module';
import minioConfig from '../../config/minio.config';
import { AppCacheModule } from '../cache/cache.module';
import { DatabaseModule } from '../database/database.module';
import { LoggingModule } from '../logging/logging.module';
import { StorageModule } from '../storage/storage.module';

const graphqlSubscriptionLogger = new Logger('GraphQLSubscription');

function getConnectionAuthorization(
  connectionParams: unknown,
  allowCapitalizedHeader: boolean,
): string {
  if (typeof connectionParams !== 'object' || connectionParams === null) {
    return '';
  }

  const headers = connectionParams as Record<string, unknown>;
  if (typeof headers.authorization === 'string') {
    return headers.authorization;
  }

  return allowCapitalizedHeader && typeof headers.Authorization === 'string'
    ? headers.Authorization
    : '';
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [minioConfig],
    }),
    DatabaseModule,
    EventsModule,
    RequestContextModule,
    LoggingModule,
    HttpContractModule,
    AppCacheModule,
    StorageModule,
    ScheduleModule.forRoot(),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      subscriptions: {
        'graphql-ws': {
          onConnect: (context) => {
            return {
              headers: {
                authorization: getConnectionAuthorization(context.connectionParams, true),
              },
              user: null,
            };
          },
          onDisconnect: () => {
            graphqlSubscriptionLogger.debug({ event: 'graphql_subscription_disconnected' });
          },
        },
      },
      context: ({ req, connectionParams }: { req?: Request; connectionParams?: unknown }) => {
        if (connectionParams) {
          return {
            connection: {
              context: {
                headers: {
                  authorization: getConnectionAuthorization(connectionParams, false),
                },
              },
            },
          };
        }

        if (req) {
          return { req };
        }

        return {};
      },
      installSubscriptionHandlers: true,
      introspection: process.env.NODE_ENV !== 'production',
      playground: false,
      debug: false,
      formatError: (error) => ({
        message: error.message,
        path: error.path,
      }),
    }),
  ],
})
export class InfraCoreModule {}
