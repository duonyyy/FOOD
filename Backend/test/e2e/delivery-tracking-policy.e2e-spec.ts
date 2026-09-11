/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-argument */
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CustomerDeliveryController } from 'src/features/delivery/controllers/customer-delivery.controller';
import { DeliveryIntegrationService } from 'src/features/delivery/services/integration/delivery-integration.service';
import {
  ORDER_TRACKING_READER,
  type OrderTrackingReaderPort,
} from 'src/features/orders/order-tracking-reader.public-api';
import { AuthGuard } from 'src/features/users/public-api';
import request = require('supertest');

describe('Customer delivery tracking policy (e2e)', () => {
  let app: INestApplication;
  let authenticated = true;
  let actorId = 'customer-a';
  const findCustomerOrderForTracking = jest.fn();

  const orderTrackingReader: OrderTrackingReaderPort = {
    findCustomerOrderForTracking,
  };
  const deliveryIntegrationService = {
    getDeliveryTracking: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CustomerDeliveryController],
      providers: [
        { provide: ORDER_TRACKING_READER, useValue: orderTrackingReader },
        { provide: DeliveryIntegrationService, useValue: deliveryIntegrationService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { user?: unknown } };
        }) => {
          if (!authenticated) {
            throw new UnauthorizedException();
          }

          context.switchToHttp().getRequest().user = { sub: actorId };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authenticated = true;
    actorId = 'customer-a';
  });

  afterAll(async () => app?.close());

  it('allows the owner and never returns the shipper phone number', async () => {
    findCustomerOrderForTracking.mockResolvedValue({ orderId: 'order-a' });
    deliveryIntegrationService.getDeliveryTracking.mockResolvedValue({
      orderId: 'order-a',
      trackingStatus: 'SHIPPING',
      shipper: { id: 'shipper-a', name: 'Shipper A', phone: '0900000000', rating: 4.8 },
    });

    const response = await request(app.getHttpServer())
      .get('/customer/deliveries/orders/order-a/track')
      .expect(200);

    const responseBody = response.body as {
      shipper: { id: string; name: string; rating: number };
    };

    expect(findCustomerOrderForTracking).toHaveBeenCalledWith('order-a', 'customer-a');
    expect(responseBody.shipper).toEqual({ id: 'shipper-a', name: 'Shipper A', rating: 4.8 });
    expect(responseBody.shipper).not.toHaveProperty('phone');
  });

  it('returns 404 and does not load tracking details when a different customer supplies the ID', async () => {
    actorId = 'customer-b';
    findCustomerOrderForTracking.mockResolvedValue(null);

    await request(app.getHttpServer()).get('/customer/deliveries/orders/order-a/track').expect(404);

    expect(deliveryIntegrationService.getDeliveryTracking).not.toHaveBeenCalled();
  });

  it('returns the same 404 for an unknown order', async () => {
    findCustomerOrderForTracking.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/customer/deliveries/orders/unknown-order/track')
      .expect(404);
  });

  it('returns 401 before the tracking lookup when JWT authentication is absent', async () => {
    authenticated = false;

    await request(app.getHttpServer()).get('/customer/deliveries/orders/order-a/track').expect(401);

    expect(findCustomerOrderForTracking).not.toHaveBeenCalled();
  });
});
