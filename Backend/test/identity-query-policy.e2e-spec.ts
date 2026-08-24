/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-argument */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthGuard, RolesGuard } from 'src/features/identity/public-api';
import { IdentityUserQueryController } from 'src/features/identity/users/identity-user-query.controller';
import { IdentityUserQueryService } from 'src/features/identity/users/identity-user-query.service';
import request = require('supertest');

describe('Identity query policy (e2e)', () => {
  let app: INestApplication;
  let usersAllowed = false;
  const queryService = {
    findCurrentUser: jest.fn().mockResolvedValue({ id: 'customer-a', username: 'customer-a' }),
    findUserById: jest.fn(),
    listUsers: jest.fn().mockResolvedValue([]),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [IdentityUserQueryController],
      providers: [{ provide: IdentityUserQueryService, useValue: queryService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user: unknown } } }) => {
          context.switchToHttp().getRequest().user = { sub: 'customer-a' };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => usersAllowed })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('uses the JWT actor for GET /users/me', async () => {
    await request(app.getHttpServer())
      .get('/users/me')
      .expect(200)
      .expect({ id: 'customer-a', username: 'customer-a' });

    expect(queryService.findCurrentUser).toHaveBeenCalledWith('customer-a');
  });

  it('returns 403 for a user list when the permission guard denies access', async () => {
    usersAllowed = false;

    await request(app.getHttpServer()).get('/users').expect(403);
  });
});
