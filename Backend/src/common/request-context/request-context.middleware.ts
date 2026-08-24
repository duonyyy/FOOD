import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { RequestContextService } from './request-context.service';
import { RequestContext } from './request-context.types';

export const REQUEST_ID_HEADER = 'X-Request-Id';
export const CORRELATION_ID_HEADER = 'X-Correlation-Id';

const MAX_CORRELATION_ID_LENGTH = 128;
const SAFE_CORRELATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const correlationId = this.readCorrelationId(request);
    const context: RequestContext = correlationId
      ? { requestId: randomUUID(), correlationId }
      : { requestId: randomUUID() };

    response.setHeader(REQUEST_ID_HEADER, context.requestId);
    if (context.correlationId) {
      response.setHeader(CORRELATION_ID_HEADER, context.correlationId);
    }

    this.requestContext.run(context, next);
  }

  private readCorrelationId(request: Request): string | undefined {
    return (
      this.readSafeHeader(request, CORRELATION_ID_HEADER) ??
      this.readSafeHeader(request, REQUEST_ID_HEADER)
    );
  }

  private readSafeHeader(request: Request, headerName: string): string | undefined {
    const rawValue = request.headers[headerName.toLowerCase()];
    if (typeof rawValue !== 'string') {
      return undefined;
    }

    const value = rawValue.trim();
    if (
      value.length === 0 ||
      value.length > MAX_CORRELATION_ID_LENGTH ||
      !SAFE_CORRELATION_ID.test(value)
    ) {
      return undefined;
    }

    return value;
  }
}
