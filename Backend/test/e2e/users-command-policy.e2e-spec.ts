/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-argument */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthGuard, RolesGuard } from 'src/features/auth/public-api';
import { AdminUsersController } from 'src/features/users/users/controllers/admin-users.controller';
import { CurrentUserController } from 'src/features/users/users/controllers/current-user.controller';
import { AdminUsersService } from 'src/features/users/users/services/admin-users.service';
import { UserProfileService } from 'src/features/users/users/services/user-profile.service';
import request = require('supertest');

describe('Users command policy (e2e)', () => {
  let app: INestApplication;
  let adminAllowed = false;
  const profiles = {
    update: jest.fn().mockResolvedValue({ id: 'customer-a', name: 'New', password: 'secret-hash' }),
  };
  const adminUsers = { create: jest.fn(), remove: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CurrentUserController, AdminUsersController],
      providers: [
        { provide: UserProfileService, useValue: profiles },
        { provide: AdminUsersService, useValue: adminUsers },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user: unknown } } }) => {
          context.switchToHttp().getRequest().user = { sub: 'customer-a' };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => adminAllowed })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('updates only the authenticated actor and strips private fields', async () => {
    await request(app.getHttpServer())
      .put('/users/me')
      .send({ name: 'New' })
      .expect(200)
      .expect({ id: 'customer-a', name: 'New' });
    expect(profiles.update).toHaveBeenCalledWith('customer-a', {
      name: 'New',
      phone: undefined,
      avatar: undefined,
      birthday: undefined,
      addresses: undefined,
    });
  });

  it('denies admin mutation without permission', async () => {
    adminAllowed = false;
    await request(app.getHttpServer()).delete('/users/other-user').expect(403);
    expect(adminUsers.remove).not.toHaveBeenCalled();
  });
});
