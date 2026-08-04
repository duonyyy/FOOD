import { ClassSerializerInterceptor, INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { assertProductionConfiguration } from './config/production-config.guard';

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
      ],
      credentials: true,
      preflightContinue: false,
      optionsSuccessStatus: 204,
    },
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn']
        : ['log', 'debug', 'error', 'verbose', 'warn'],
  });

  // Optimized validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

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
    console.log(`Application is running on: http://localhost:${port}`);
    console.log(`Swagger documentation: http://localhost:${port}/api`);
    console.log('Allowed CORS origins:', allowedOrigins);
  }
}

bootstrap().catch((error) => {
  console.error('Error starting server:', error);
  process.exit(1);
});
