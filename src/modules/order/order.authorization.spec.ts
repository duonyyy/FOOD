import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { OrderController } from './order.controller';

describe('Order authorization characterization', () => {
  let orderService: {
    getOrderById: jest.Mock;
    getOrdersByUser: jest.Mock;
    createOrder: jest.Mock;
  };
  let paymentService: { createCheckout: jest.Mock };
  let controller: OrderController;

  beforeEach(() => {
    orderService = {
      getOrderById: jest.fn(),
      getOrdersByUser: jest.fn(),
      createOrder: jest.fn().mockResolvedValue({
        id: 'order-1',
        status: 'pending',
        total: 100,
        paymentMethod: 'momo',
        createdAt: new Date('2026-08-01T00:00:00Z'),
      }),
    };
    paymentService = {
      createCheckout: jest.fn().mockResolvedValue({ id: 'checkout-1', paymentUrl: 'https://pay' }),
    };
    controller = new OrderController(
      orderService as never,
      paymentService as never,
      { findByOwnerId: jest.fn() } as never,
      { addPendingAssignment: jest.fn(), removePendingAssignment: jest.fn() } as never,
    );
  });

  it('protects order detail route with AuthGuard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      OrderController.prototype.getOrderById,
    ) as unknown[];
    expect(guards).toContain(AuthGuard);
  });

  it("returns 403 when Customer A reads Customer B's order", async () => {
    orderService.getOrderById.mockResolvedValue({
      id: 'order-b',
      user: { id: 'customer-b' },
      restaurant: { owner: { id: 'owner-b' } },
    });

    await expect(
      controller.getOrderById('order-b', { headers: {}, user: { id: 'customer-a' } }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows the restaurant owner to read an order for that restaurant', async () => {
    const order = {
      id: 'order-1',
      user: { id: 'customer-a' },
      restaurant: { owner: { id: 'owner-a' } },
    };
    orderService.getOrderById.mockResolvedValue(order);

    await expect(
      controller.getOrderById('order-1', { headers: {}, user: { id: 'owner-a' } }),
    ).resolves.toBe(order);
  });

  it('does not trust body.userId when creating an order', async () => {
    const body = {
      userId: 'customer-b',
      restaurantId: 'restaurant-1',
      addressId: 'address-1',
      total: 100,
      paymentMethod: 'momo',
      orderDetails: [],
    };

    await controller.createOrder(body, { headers: {}, user: { id: 'customer-a' } });

    expect(orderService.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'customer-a' }),
    );
  });
});
