/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-argument */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthController } from 'src/features/auth/auth.controller';
import { AuthService } from 'src/features/auth/auth.service';
import { AuthGuard } from 'src/features/auth/public-api';
import request = require('supertest');

describe('Auth login HTTP contract (e2e)', () => {
  let app: INestApplication;
  const auth = {
    loginWithEmailPassword: jest.fn().mockResolvedValue({
      accessToken: 'jwt-token',
      token: 'jwt-token',
      user: { id: 'user-1', role: 'user' },
      message: 'Login successful',
    }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: auth }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('preserves POST /auth/login/email and its response', async () => {
    await request(app.getHttpServer())
      .post('/auth/login/email')
      .send({ email: 'customer@example.com', password: 'secret-password' })
      .expect(201)
      .expect({
        accessToken: 'jwt-token',
        token: 'jwt-token',
        user: { id: 'user-1', role: 'user' },
        message: 'Login successful',
      });
    expect(auth.loginWithEmailPassword).toHaveBeenCalledWith(
      'customer@example.com',
      'secret-password',
    );
  });
});
