/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-argument */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthGuard } from 'src/features/identity/public-api';
import { RestaurantMerchantController } from 'src/features/restaurants/controllers/merchant-profile.controller';
import { RestaurantProfileService } from 'src/features/restaurants/services/restaurant-profile.service';
import request = require('supertest');

describe('Restaurant onboarding policy (e2e)', () => {
  let app: INestApplication;
  const service = {
    requestRestaurantWithFiles: jest.fn().mockResolvedValue({
      id: 'restaurant-1',
      name: 'Quán thử nghiệm',
      status: 'pending',
      owner: { id: 'owner-from-jwt' },
    }),
    findByOwnerId: jest.fn(),
    updateWithFiles: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [RestaurantMerchantController],
      providers: [{ provide: RestaurantProfileService, useValue: service }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user: unknown } } }) => {
          context.switchToHttp().getRequest().user = { sub: 'owner-from-jwt' };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => jest.clearAllMocks());

  const validRequest = {
    name: 'Quán thử nghiệm',
    addressStreet: '1 Đường A',
    addressWard: 'Phường 1',
    addressDistrict: 'Quận 1',
    addressCity: 'Hồ Chí Minh',
  };

  it('rejects a client-supplied ownerId before onboarding', async () => {
    await request(app.getHttpServer())
      .post('/merchant/restaurants')
      .send({ ...validRequest, ownerId: 'another-user' })
      .expect(400);

    expect(service.requestRestaurantWithFiles).not.toHaveBeenCalled();
  });

  it('passes only the JWT actor to the onboarding service', async () => {
    await request(app.getHttpServer()).post('/merchant/restaurants').send(validRequest).expect(201);

    expect(service.requestRestaurantWithFiles).toHaveBeenCalledWith(
      'owner-from-jwt',
      expect.objectContaining(validRequest),
      undefined,
      undefined,
      undefined,
    );
  });

  it('forbids an owner from updating another restaurant', async () => {
    service.findByOwnerId.mockResolvedValue({ id: 'restaurant-owned-by-someone-else' });

    await request(app.getHttpServer())
      .put('/merchant/restaurants/restaurant-not-owned')
      .send({ name: 'Không được phép' })
      .expect(403);

    expect(service.update).not.toHaveBeenCalled();
  });
});
