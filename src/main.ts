import { ClassSerializerInterceptor, INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/http-contract/api-exception.filter';
import { ResponseEnvelopeInterceptor } from './common/http-contract/response-envelope.interceptor';
import { RequestContextMiddleware } from './common/request-context/request-context.middleware';
import { assertProductionConfiguration } from './config/production-config.guard';
import { HttpRequestLoggingMiddleware } from './infra/logging/http-request-logging.middleware';
import { StructuredLoggerService } from './infra/logging/structured-logger.service';

async function bootstrap(): Promise<void> {
  assertProductionConfiguration();
  // Define allowed origins
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://foodee-fe.onrender.com',
  ];

  // Add additional origins from environment variable if provided
  if (process.env.ALLOWED_ORIGINS) {
    const envOrigins = process.env.ALLOWED_ORIGINS.split(',');
    allowedOrigins.push(...envOrigins);
  }

  const app: INestApplication = await NestFactory.create(AppModule, new ExpressAdapter(), {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'Origin',
        'X-Requested-With',
        'Access-Control-Allow-Headers',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers',
        'X-Request-Id',
        'X-Correlation-Id',
      ],
      exposedHeaders: ['X-Request-Id', 'X-Correlation-Id', 'X-Total-Count'],
      credentials: true,
      preflightContinue: false,
      optionsSuccessStatus: 204,
    },
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn']
        : ['log', 'debug', 'error', 'verbose', 'warn'],
  });

  const structuredLogger = app.get(StructuredLoggerService);
  app.useLogger(structuredLogger);

  const requestContextMiddleware = app.get(RequestContextMiddleware);
  const httpRequestLoggingMiddleware = app.get(HttpRequestLoggingMiddleware);
  app.use(requestContextMiddleware.use.bind(requestContextMiddleware));
  app.use(httpRequestLoggingMiddleware.use.bind(httpRequestLoggingMiddleware));
  app.useGlobalFilters(app.get(ApiExceptionFilter));

  // Optimized validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
    app.get(ResponseEnvelopeInterceptor),
  );

  // Only setup Swagger in development
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('FOODEE API')
      .setDescription('The FOODEE API description')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);

  if (process.env.NODE_ENV !== 'production') {
    structuredLogger.log({ event: 'application_started', port });
    structuredLogger.log({ event: 'swagger_enabled', path: '/api' });
    structuredLogger.log({ event: 'cors_configured', allowedOriginCount: allowedOrigins.length });
  }
}

bootstrap().catch((error) => {
  console.error('Error starting server:', error);
  process.exit(1);
});
