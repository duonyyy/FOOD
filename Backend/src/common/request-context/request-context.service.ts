import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { RequestContext } from './request-context.types';

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<Readonly<RequestContext>>();

  run<T>(context: RequestContext, callback: () => T): T {
    return this.storage.run(Object.freeze({ ...context }), callback);
  }

  get(): Readonly<RequestContext> | undefined {
    return this.storage.getStore();
  }

  getRequestId(): string | undefined {
    return this.get()?.requestId;
  }

  snapshot(): RequestContext | undefined {
    const context = this.get();
    return context ? { ...context } : undefined;
  }
}
