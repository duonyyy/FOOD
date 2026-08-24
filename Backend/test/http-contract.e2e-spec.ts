/* eslint-disable @typescript-eslint/no-require-imports */
import { BadRequestException, Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import { ApiExceptionFilter } from '../src/common/http-contract/api-exception.filter';
import { HttpContractModule } from '../src/common/http-contract/http-contract.module';
import { createPaginatedResponse } from '../src/common/http-contract/pagination';
import { ResponseEnvelope } from '../src/common/http-contract/response-envelope.decorator';
import { ResponseEnvelopeInterceptor } from '../src/common/http-contract/response-envelope.interceptor';
import { RequestContextMiddleware } from '../src/common/request-context/request-context.middleware';
import { RequestContextModule } from '../src/common/request-context/request-context.module';
import request = require('supertest');

@Controller('contract')
class HttpContractTestController {
  @Get('legacy')
  getLegacy(): { legacy: boolean } {
    return { legacy: true };
  }

  @Get('success')
  @ResponseEnvelope()
  getSuccess(): { id: string } {
    return { id: 'food-1' };
  }

  @Get('page')
  @ResponseEnvelope()
  getPage() {
    return createPaginatedResponse([{ id: 'food-1' }], { page: 1, limit: 2, total: 3 });
  }

  @Get('validation-error')
  getValidationError(): never {
    throw new BadRequestException(['name must be a string']);
  }

  @Get('unexpected-error')
  getUnexpectedError(): never {
    throw new Error('database password should never reach a client');
  }
}

describe('HTTP response contract (e2e)', () => {
  let app: INestApplication<Server>;

  function httpServer(): Server {
    return app.getHttpServer();
  }

  beforeAll(async () => {
    app = await createHttpContractApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps legacy success responses unchanged until a controller explicitly opts in', async () => {
    await request(httpServer()).get('/contract/legacy').expect(200).expect({ legacy: true });
  });

  it('wraps explicitly opted-in responses in a success envelope', async () => {
    await request(httpServer())
      .get('/contract/success')
      .expect(200)
      .expect({ data: { id: 'food-1' } });
  });

  it('returns standard pagination metadata and X-Total-Count for opted-in responses', async () => {
    const response = await request(httpServer()).get('/contract/page').expect(200);

    expect(response.headers['x-total-count']).toBe('3');
    expect(response.body).toEqual({
      data: [{ id: 'food-1' }],
      meta: { page: 1, limit: 2, total: 3, totalPages: 2, hasNextPage: true },
    });
  });

  it('returns validation details and the same request ID in header and error body', async () => {
    const response = await request(httpServer()).get('/contract/validation-error').expect(400);

    expect(response.body).toEqual({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: ['name must be a string'],
      requestId: response.headers['x-request-id'],
    });
  });

  it('does not expose an unexpected error stack or internal message', async () => {
    const response = await request(httpServer()).get('/contract/unexpected-error').expect(500);

    expect(response.body).toMatchObject({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      requestId: response.headers['x-request-id'],
    });
    expect(response.body).not.toHaveProperty('stack');
    expect(JSON.stringify(response.body)).not.toContain('database password');
  });
});

async function createHttpContractApp(): Promise<INestApplication<Server>> {
  const module = await Test.createTestingModule({
    imports: [RequestContextModule, HttpContractModule],
    controllers: [HttpContractTestController],
  }).compile();
  const app = module.createNestApplication<INestApplication<Server>>();
  const requestContextMiddleware = app.get(RequestContextMiddleware);

  app.use(requestContextMiddleware.use.bind(requestContextMiddleware));
  app.useGlobalFilters(app.get(ApiExceptionFilter));
  app.useGlobalInterceptors(app.get(ResponseEnvelopeInterceptor));
  await app.init();

  return app;
}
