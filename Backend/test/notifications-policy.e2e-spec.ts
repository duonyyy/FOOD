/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-argument */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NotificationController } from 'src/features/communications/notifications/notification.controller';
import { NotificationService } from 'src/features/communications/notifications/notification.service';
import { AuthGuard } from 'src/features/identity/public-api';
import request = require('supertest');

describe('Notifications policy (e2e)', () => {
  let app: INestApplication;
  const notificationService = {
    findByUser: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    markAsRead: jest.fn().mockResolvedValue({ id: '00000000-0000-4000-8000-000000000001' }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [{ provide: NotificationService, useValue: notificationService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user: unknown } } }) => {
          context.switchToHttp().getRequest().user = { sub: 'customer-a' };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('uses the JWT actor and pagination parameters for GET /notifications', async () => {
    await request(app.getHttpServer())
      .get('/notifications?page=2&limit=10')
      .expect(200)
      .expect({ data: [], total: 0 });

    expect(notificationService.findByUser).toHaveBeenCalledWith('customer-a', 2, 10);
  });

  it('uses the JWT actor for PATCH /notifications/:id/read', async () => {
    const notificationId = '00000000-0000-4000-8000-000000000001';

    await request(app.getHttpServer()).patch(`/notifications/${notificationId}/read`).expect(200);

    expect(notificationService.markAsRead).toHaveBeenCalledWith(notificationId, 'customer-a');
  });
});
