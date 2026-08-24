import { ForbiddenException } from '@nestjs/common';
import { OrderActorPolicy } from './order-actor.policy';

describe('OrderActorPolicy', () => {
  const policy = new OrderActorPolicy();
  const order = {
    user: { id: 'customer-1' },
    restaurant: { owner: { id: 'merchant-1' } },
    shippingDetail: { shipper: { id: 'shipper-1' } },
  };

  it.each(['customer-1', 'merchant-1', 'shipper-1'])('allows participant %s to read', (actorId) => {
    expect(() => policy.assertCanRead(order, actorId)).not.toThrow();
  });

  it('blocks an unrelated actor from reading', () => {
    expect(() => policy.assertCanRead(order, 'other-user')).toThrow(ForbiddenException);
  });

  it('allows only the customer to delete/pay', () => {
    expect(() => policy.assertCanDelete(order, 'customer-1')).not.toThrow();
    expect(() => policy.assertCanPay(order, 'customer-1')).not.toThrow();
    expect(() => policy.assertCanDelete(order, 'merchant-1')).toThrow(ForbiddenException);
    expect(() => policy.assertCanPay(order, 'shipper-1')).toThrow(ForbiddenException);
  });

  it('allows only the restaurant owner to manage merchant status', () => {
    expect(() => policy.assertCanManageRestaurantOrder(order, 'merchant-1')).not.toThrow();
    expect(() => policy.assertCanManageRestaurantOrder(order, 'customer-1')).toThrow(
      ForbiddenException,
    );
  });
});
