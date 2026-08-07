import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { RequestContextService } from 'src/common/request-context/request-context.service';

interface ApiErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  details?: string[];
  requestId?: string;
}

type UnknownRecord = Record<string, unknown>;

const STATUS_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getSafeCode(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(value) ? value : undefined;
}

function getSafeMessage(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 512) : undefined;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(private readonly requestContext: RequestContextService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const errorResponse = this.toErrorResponse(exception);

    this.logger.error({
      event: 'http_request_failed',
      method: request.method,
      route: request.path,
      statusCode: errorResponse.statusCode,
      code: errorResponse.code,
      ...(errorResponse.requestId ? { requestId: errorResponse.requestId } : {}),
    });

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private toErrorResponse(exception: unknown): ApiErrorResponse {
    const statusCode: number =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const source = exception instanceof HttpException ? exception.getResponse() : undefined;
    const sourceObject = isRecord(source) ? source : undefined;
    const sourceMessage = sourceObject?.message ?? source;
    const details = Array.isArray(sourceMessage)
      ? sourceMessage.map(getSafeMessage).filter((detail): detail is string => Boolean(detail))
      : undefined;
    const code =
      statusCode === Number(HttpStatus.BAD_REQUEST) && details?.length
        ? 'VALIDATION_ERROR'
        : (getSafeCode(sourceObject?.code) ?? STATUS_CODES[statusCode] ?? `HTTP_${statusCode}`);
    const message =
      statusCode >= Number(HttpStatus.INTERNAL_SERVER_ERROR)
        ? 'Internal server error'
        : details?.length
          ? 'Validation failed'
          : (getSafeMessage(sourceMessage) ?? 'Request failed');
    const requestId = this.requestContext.getRequestId();

    return {
      statusCode,
      code,
      message,
      ...(details?.length ? { details } : {}),
      ...(requestId ? { requestId } : {}),
    };
  }
}
