import { RequestContextService } from 'src/common/request-context/request-context.service';
import { StructuredLoggerService } from './structured-logger.service';

type PinoInfo = {
  info: (fields: Record<string, unknown>, message: string) => void;
};

describe('StructuredLoggerService', () => {
  it('adds the current request and correlation IDs to structured HTTP logs', () => {
    const requestContext = new RequestContextService();
    const logger = new StructuredLoggerService(requestContext);
    const pinoLogger = (logger as unknown as { logger: PinoInfo }).logger;
    const info = jest.spyOn(pinoLogger, 'info').mockImplementation();

    requestContext.run(
      { requestId: 'server-request-1', correlationId: 'gateway-request-1' },
      () => {
        logger.requestCompleted({
          method: 'GET',
          route: '/restaurants/:id',
          statusCode: 200,
          durationMs: 12.5,
          actorId: 'customer-1',
        });
      },
    );

    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'server-request-1',
        correlationId: 'gateway-request-1',
        method: 'GET',
        route: '/restaurants/:id',
        statusCode: 200,
        durationMs: 12.5,
        actorId: 'customer-1',
      }),
      'http_request_completed',
    );
  });
});
