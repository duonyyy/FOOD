import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginationMeta } from './pagination';
import { RESPONSE_ENVELOPE_KEY } from './response-envelope.decorator';

interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  return typeof value === 'object' && value !== null && 'data' in value;
}

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const enabled = this.reflector.getAllAndOverride<boolean>(RESPONSE_ENVELOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!enabled || context.getType() !== 'http') {
      return next.handle();
    }

    return next.handle().pipe(
      map((response: unknown) => {
        const normalized = isApiResponse(response) ? response : { data: response };

        if (normalized.meta) {
          const httpResponse = context.switchToHttp().getResponse<Response>();
          httpResponse.setHeader('X-Total-Count', String(normalized.meta.total));
        }

        return normalized;
      }),
    );
  }
}
