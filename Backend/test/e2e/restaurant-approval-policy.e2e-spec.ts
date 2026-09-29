/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-argument */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RolesGuard } from 'src/features/auth/guards/roles.guard';
import { AdminRestaurantsController } from 'src/features/restaurants/controllers/admin-restaurants.controller';
import { AdminRestaurantsService } from 'src/features/restaurants/services/admin-restaurants.service';
import request = require('supertest');

describe('Restaurant approval policy (e2e)', () => {
  let app: INestApplication;
  let hasRestaurantWriteCapability = true;
  const adminService = {
    getRestaurantRequests: jest.fn(),
    deleteRestaurantRequest: jest.fn(),
    approveRestaurant: jest.fn().mockResolvedValue({
      id: 'restaurant-1',
      name: 'Quán thử nghiệm',
      status: 'approved',
      owner: { id: 'owner-1' },
    }),
    rejectRestaurant: jest.fn().mockResolvedValue({
      id: 'restaurant-1',
      name: 'Quán thử nghiệm',
      status: 'rejected',
      owner: { id: 'owner-1' },
    }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminRestaurantsController],
      providers: [{ provide: AdminRestaurantsService, useValue: adminService }],
    })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user: unknown } } }) => {
          if (!hasRestaurantWriteCapability) {
            return false;
          }
          context.switchToHttp().getRequest().user = { sub: 'admin-from-jwt' };
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

  afterAll(async () => app?.close());
  beforeEach(() => {
    jest.clearAllMocks();
    hasRestaurantWriteCapability = true;
  });

  it('forbids an actor without the restaurant write capability', async () => {
    hasRestaurantWriteCapability = false;

    await request(app.getHttpServer())
      .put('/admin/restaurants/restaurant-1/approve')
      .send({})
      .expect(403);

    expect(adminService.approveRestaurant).not.toHaveBeenCalled();
  });

  it('passes the JWT admin and audit note to approve use case', async () => {
    await request(app.getHttpServer())
      .put('/admin/restaurants/restaurant-1/approve')
      .send({ note: 'Hồ sơ hợp lệ' })
      .expect(200);

    expect(adminService.approveRestaurant).toHaveBeenCalledWith('restaurant-1', 'admin-from-jwt', {
      note: 'Hồ sơ hợp lệ',
    });
  });

  it('requires a reason before it reaches the reject use case', async () => {
    await request(app.getHttpServer())
      .put('/admin/restaurants/restaurant-1/reject')
      .send({})
      .expect(400);

    expect(adminService.rejectRestaurant).not.toHaveBeenCalled();
  });

  it('passes the JWT admin and rejection reason to the use case', async () => {
    await request(app.getHttpServer())
      .put('/admin/restaurants/restaurant-1/reject')
      .send({ reason: 'Giấy phép chưa hợp lệ' })
      .expect(200);

    expect(adminService.rejectRestaurant).toHaveBeenCalledWith('restaurant-1', 'admin-from-jwt', {
      reason: 'Giấy phép chưa hợp lệ',
    });
  });
});
