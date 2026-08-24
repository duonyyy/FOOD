/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-argument */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthGuard, RolesGuard } from 'src/features/identity/public-api';
import { RestaurantProfileService } from 'src/features/restaurants/services/restaurant-profile.service';
import { PendingAssignmentService } from 'src/infra/queue/pending-assignment.service';
import { OrderController } from 'src/modules/order/order.controller';
import { OrderService } from 'src/modules/order/order.service';
import { PaymentService } from 'src/payment/payment.service';
import request = require('supertest');

describe('Order actor policy (e2e)', () => {
  let app: INestApplication;
  let actorId = 'customer-a';
  let adminAllowed = false;
  const orderService = {
    createOrder: jest.fn().mockResolvedValue({
      id: 'order-1',
      status: 'pending',
      total: 100,
      paymentMethod: 'cod',
      createdAt: new Date('2026-08-01T00:00:00Z'),
    }),
    getOrderById: jest.fn().mockResolvedValue({
      id: 'order-1',
      user: { id: 'customer-a' },
      restaurant: { owner: { id: 'merchant-a' } },
      shippingDetail: { shipper: { id: 'shipper-a' } },
    }),
    updateOrderStatus: jest.fn().mockResolvedValue({ id: 'order-1', status: 'confirmed' }),
    getOrdersByUser: jest.fn().mockResolvedValue({ items: [] }),
    getOrderDetails: jest.fn().mockResolvedValue([]),
    deleteOrder: jest.fn().mockResolvedValue({ message: 'deleted' }),
    processPayment: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        { provide: OrderService, useValue: orderService },
        { provide: PaymentService, useValue: { createCheckout: jest.fn() } },
        { provide: RestaurantProfileService, useValue: { findByOwnerId: jest.fn() } },
        {
          provide: PendingAssignmentService,
          useValue: { addPendingAssignment: jest.fn(), removePendingAssignment: jest.fn() },
        },
      ],
    })
      .overrideProvider(OrderService)
      .useValue(orderService)
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user: unknown } } }) => {
          context.switchToHttp().getRequest().user = { sub: actorId };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user: unknown } } }) => {
          if (!adminAllowed) return false;
          context.switchToHttp().getRequest().user = { sub: 'admin-from-jwt' };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    actorId = 'customer-a';
    adminAllowed = false;
  });

  afterAll(async () => app?.close());

  it('uses the JWT customer for order creation and ignores body userId', async () => {
    await request(app.getHttpServer())
      .post('/orders')
      .send({
        userId: 'customer-b',
        restaurantId: 'restaurant-1',
        addressId: 'address-1',
        paymentMethod: 'cod',
        orderDetails: [],
      })
      .expect(201);

    expect(orderService.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'customer-a' }),
    );
  });

  it('allows only the JWT merchant owner to update restaurant order status', async () => {
    actorId = 'merchant-a';

    await request(app.getHttpServer())
      .put('/orders/order-1/status')
      .send({ status: 'confirmed' })
      .expect(200);

    expect(orderService.updateOrderStatus).toHaveBeenCalledWith('order-1', 'confirmed');

    actorId = 'customer-a';
    await request(app.getHttpServer())
      .put('/orders/order-1/status')
      .send({ status: 'confirmed' })
      .expect(403);
  });

  it('requires the admin capability for the admin status route', async () => {
    await request(app.getHttpServer())
      .put('/orders/admin/order-1/status')
      .send({ status: 'canceled' })
      .expect(403);

    adminAllowed = true;
    await request(app.getHttpServer())
      .put('/orders/admin/order-1/status')
      .send({ status: 'canceled' })
      .expect(200);

    expect(orderService.updateOrderStatus).toHaveBeenCalledWith('order-1', 'canceled');
  });
});
