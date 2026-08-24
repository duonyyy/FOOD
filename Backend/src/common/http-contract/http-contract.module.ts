import { Global, Module } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';

@Global()
@Module({
  providers: [ApiExceptionFilter, ResponseEnvelopeInterceptor],
  exports: [ApiExceptionFilter, ResponseEnvelopeInterceptor],
})
export class HttpContractModule {}
