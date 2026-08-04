import { Injectable, LoggerService } from '@nestjs/common';
import pino, { Logger as PinoLogger } from 'pino';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { ExternalProvider, getProviderErrorCode, getProviderErrorType } from './provider-error';

type LogFields = Record<string, unknown>;
type PinoLevel = 'info' | 'error' | 'warn' | 'debug' | 'trace' | 'fatal';

export interface HttpRequestLogFields {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  actorId?: string;
}

function isRecord(value: unknown): value is LogFields {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class StructuredLoggerService implements LoggerService {
  private readonly logger: PinoLogger;

  constructor(private readonly requestContext: RequestContextService) {
    this.logger = pino({
      level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
      base: { service: 'foodee-be' },
      redact: {
        paths: [
          'authorization',
          'cookie',
          'password',
          'token',
          'accessToken',
          'refreshToken',
          'secret',
          'signature',
          'req.headers.authorization',
          'req.headers.cookie',
        ],
        remove: true,
      },
    });
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('trace', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  requestCompleted(fields: HttpRequestLogFields): void {
    this.logger.info(this.withRequestContext(fields), 'http_request_completed');
  }

  providerError(provider: ExternalProvider, operation: string, error: unknown): void {
    this.logger.error(
      this.withRequestContext({
        event: 'provider_operation_failed',
        provider,
        operation,
        errorCode: getProviderErrorCode(error),
        errorType: getProviderErrorType(error),
      }),
      'provider_operation_failed',
    );
  }

  private write(level: PinoLevel, message: unknown, optionalParams: unknown[]): void {
    const fields = isRecord(message) ? { ...message } : {};
    const structuredMessage = typeof fields.message === 'string' ? fields.message : undefined;
    delete fields.message;

    const nestjsContext = this.getNestjsContext(optionalParams);
    if (nestjsContext) {
      fields.nestjsContext = nestjsContext;
    }

    const text = structuredMessage ?? (typeof message === 'string' ? message : 'nestjs_log');
    this.logger[level](this.withRequestContext(fields), text);
  }

  private withRequestContext(fields: object): LogFields {
    const context = this.requestContext.get();
    return {
      ...fields,
      ...(context?.requestId ? { requestId: context.requestId } : {}),
      ...(context?.correlationId ? { correlationId: context.correlationId } : {}),
    };
  }

  private getNestjsContext(optionalParams: unknown[]): string | undefined {
    const context = optionalParams.at(-1);
    return typeof context === 'string' ? context : undefined;
  }
}
