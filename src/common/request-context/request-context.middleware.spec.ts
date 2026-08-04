import { Request, Response } from 'express';
import {
  CORRELATION_ID_HEADER,
  REQUEST_ID_HEADER,
  RequestContextMiddleware,
} from './request-context.middleware';
import { RequestContextService } from './request-context.service';

describe('RequestContextMiddleware', () => {
  function createRequest(headers: Record<string, string | string[]> = {}): Request {
    return { headers } as Request;
  }

  function createResponse(): { response: Response; setHeader: jest.Mock } {
    const setHeader = jest.fn();
    return {
      response: { setHeader } as unknown as Response,
      setHeader,
    };
  }

  it('creates a server request ID and keeps it through an async service boundary', async () => {
    const contextService = new RequestContextService();
    const middleware = new RequestContextMiddleware(contextService);
    const { response, setHeader } = createResponse();

    const observedContext = await new Promise<ReturnType<RequestContextService['get']>>(
      (resolve, reject) => {
        middleware.use(createRequest(), response, () => {
          setImmediate(() => {
            try {
              resolve(contextService.get());
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          });
        });
      },
    );

    expect(observedContext).toBeDefined();
    expect(observedContext?.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, observedContext?.requestId);
    expect(setHeader).not.toHaveBeenCalledWith(CORRELATION_ID_HEADER, expect.anything());
  });

  it('keeps a valid upstream ID as correlation metadata without letting it replace server request ID', () => {
    const contextService = new RequestContextService();
    const middleware = new RequestContextMiddleware(contextService);
    const { response, setHeader } = createResponse();
    let observedContext: ReturnType<RequestContextService['get']>;

    middleware.use(createRequest({ 'x-request-id': 'gateway-42' }), response, () => {
      observedContext = contextService.get();
    });

    expect(observedContext).toMatchObject({
      correlationId: 'gateway-42',
    });
    expect(typeof observedContext?.requestId).toBe('string');
    expect(observedContext?.requestId).not.toBe('gateway-42');
    expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, 'gateway-42');
  });

  it('rejects malformed correlation input and never stores request body or authorization data', () => {
    const contextService = new RequestContextService();
    const middleware = new RequestContextMiddleware(contextService);
    const { response } = createResponse();
    let observedContext: ReturnType<RequestContextService['get']>;

    const request = createRequest({
      'x-correlation-id': 'unsafe\nvalue',
      authorization: 'Bearer secret-token',
    });
    Object.assign(request, { body: { password: 'secret-password' } });

    middleware.use(request, response, () => {
      observedContext = contextService.get();
    });

    expect(typeof observedContext?.requestId).toBe('string');
    expect(observedContext?.correlationId).toBeUndefined();
    expect(contextService.snapshot()).toBeUndefined();
  });

  it('supports explicit snapshot and restore for work that leaves the HTTP async flow', () => {
    const contextService = new RequestContextService();
    const snapshot = contextService.run(
      { requestId: 'server-request-1', correlationId: 'upstream-1' },
      () => contextService.snapshot(),
    );

    const restoredRequestId = contextService.run(snapshot!, () => contextService.getRequestId());

    expect(restoredRequestId).toBe('server-request-1');
  });
});
