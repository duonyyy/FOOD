import { Request, Response } from 'express';
import { EventEmitter } from 'node:events';
import { HttpRequestLoggingMiddleware } from './http-request-logging.middleware';
import { HttpRequestLogFields, StructuredLoggerService } from './structured-logger.service';

describe('HttpRequestLoggingMiddleware', () => {
  it('logs only safe request metadata after the response completes', () => {
    const requestCompleted = jest.fn<void, [HttpRequestLogFields]>();
    const logger = { requestCompleted } as unknown as StructuredLoggerService;
    const middleware = new HttpRequestLoggingMiddleware(logger);
    const response = Object.assign(new EventEmitter(), { statusCode: 201 }) as unknown as Response;
    const request = {
      baseUrl: '',
      method: 'POST',
      path: '/orders/order-1',
      route: { path: '/orders/:id' },
      user: { id: 'customer-1', password: 'must-not-be-logged' },
    } as unknown as Request;

    middleware.use(request, response, jest.fn());
    response.emit('finish');

    const [fields] = requestCompleted.mock.calls[0];
    expect(fields.method).toBe('POST');
    expect(fields.route).toBe('/orders/:id');
    expect(fields.statusCode).toBe(201);
    expect(fields.actorId).toBe('customer-1');
    expect(fields.durationMs).toBeGreaterThanOrEqual(0);
    expect(fields).not.toHaveProperty('body');
    expect(fields).not.toHaveProperty('authorization');
    expect(fields).not.toHaveProperty('password');
  });
});
