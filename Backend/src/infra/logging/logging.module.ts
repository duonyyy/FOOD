import { Global, Module } from '@nestjs/common';
import { HttpRequestLoggingMiddleware } from './http-request-logging.middleware';
import { StructuredLoggerService } from './structured-logger.service';

@Global()
@Module({
  providers: [StructuredLoggerService, HttpRequestLoggingMiddleware],
  exports: [StructuredLoggerService, HttpRequestLoggingMiddleware],
})
export class LoggingModule {}
