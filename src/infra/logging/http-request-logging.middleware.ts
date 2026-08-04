import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { StructuredLoggerService } from './structured-logger.service';

type RequestActor = { id?: unknown };
type MatchedRoute = { path?: unknown };

@Injectable()
export class HttpRequestLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: StructuredLoggerService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();

    response.once('finish', () => {
      this.logger.requestCompleted({
        method: request.method,
        route: this.getRoute(request),
        statusCode: response.statusCode,
        durationMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
        ...(this.getActorId(request) ? { actorId: this.getActorId(request) } : {}),
      });
    });

    next();
  }

  private getRoute(request: Request): string {
    const matchedRoute = (request.route as MatchedRoute | undefined)?.path;
    return typeof matchedRoute === 'string' ? `${request.baseUrl}${matchedRoute}` : request.path;
  }

  private getActorId(request: Request): string | undefined {
    const actor = (request as Request & { user?: RequestActor }).user;
    return typeof actor?.id === 'string' ? actor.id : undefined;
  }
}
