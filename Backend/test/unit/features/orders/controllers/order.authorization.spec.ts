import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Permission } from 'src/constants/permission.enum';
import { PERMISSIONS_KEY } from 'src/features/auth/decorators/permissions.decorator';
import { AuthGuard } from 'src/features/auth/guards/auth.guard';
import { RolesGuard } from 'src/features/auth/guards/roles.guard';
import { OrderController } from 'src/features/orders/controllers/order.controller';

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
      // Decorator metadata must be read from the method reference; it is not invoked here.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      OrderController.prototype.getOrderById,
    ) as unknown[];
    expect(guards).toContain(AuthGuard);
  });

  it('protects the admin status route with the order write capability', () => {
    const method = Object.getOwnPropertyDescriptor(
      OrderController.prototype,
      'adminUpdateOrderStatus',
    )?.value as object;
    const guards = Reflect.getMetadata(GUARDS_METADATA, method) as unknown[];
    const permissions = Reflect.getMetadata(PERMISSIONS_KEY, method) as string[];

    expect(guards).toContain(RolesGuard);
    expect(permissions).toEqual([Permission.ORDER.WRITE]);
  });

  it("returns 403 when Customer A reads Customer B's order", async () => {
    orderService.getOrderById.mockResolvedValue({
      id: 'order-b',
      user: { id: 'customer-b' },
      restaurant: { owner: { id: 'owner-b' } },
    });

    await expect(
      controller.getOrderById('order-b', { userId: 'customer-a' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows the restaurant owner to read an order for that restaurant', async () => {
    const order = {
      id: 'order-1',
      user: { id: 'customer-a' },
      restaurant: { owner: { id: 'owner-a' } },
    };
    orderService.getOrderById.mockResolvedValue(order);

    await expect(controller.getOrderById('order-1', { userId: 'owner-a' })).resolves.toBe(order);
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

    await controller.createOrder(body, { userId: 'customer-a' });

    expect(orderService.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'customer-a' }),
    );
  });

  it('allows an administrator to read any order', async () => {
    const order = {
      id: 'order-b',
      user: { id: 'customer-b' },
      restaurant: { owner: { id: 'owner-b' } },
    };
    orderService.getOrderById.mockResolvedValue(order);

    await expect(
      controller.getOrderById('order-b', { userId: 'admin-user', role: 'admin' }),
    ).resolves.toBe(order);
  });

  it("forbids a customer from reading another user's orders via getOrdersByUser", () => {
    expect(() => controller.getOrdersByUser('customer-b', { userId: 'customer-a' })).toThrow(
      ForbiddenException,
    );
  });

  it("allows an admin to read another user's orders via getOrdersByUser", () => {
    orderService.getOrdersByUser.mockReturnValue({ items: [] });

    expect(() =>
      controller.getOrdersByUser('customer-b', { userId: 'admin-user', role: 'admin' }),
    ).not.toThrow();
    expect(orderService.getOrdersByUser).toHaveBeenCalledWith('customer-b');
  });

  it('allows user to read their own orders via getOrdersByUser', () => {
    orderService.getOrdersByUser.mockReturnValue({ items: [] });

    expect(() => controller.getOrdersByUser('customer-a', { userId: 'customer-a' })).not.toThrow();
    expect(orderService.getOrdersByUser).toHaveBeenCalledWith('customer-a');
  });
});
