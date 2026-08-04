import { instanceToPlain } from 'class-transformer';
import { Order } from 'src/entities/order.entity';
import { Restaurant } from 'src/entities/restaurant.entity';
import { ShipperCertificateInfo } from 'src/entities/shipperCertificateInfo.entity';
import { ShippingDetail } from 'src/entities/shippingDetail.entity';
import { User } from 'src/entities/user.entity';
import { toSafeUserResponse } from './mappers/safe-user-response.mapper';

describe('User response serialization', () => {
  const createSensitiveUser = (): User =>
    Object.assign(new User(), {
      id: 'user-1',
      username: 'customer',
      password: 'bcrypt-hash',
      googleId: 'google-subject',
      resetPasswordToken: 'reset-token',
      resetPasswordExpires: new Date('2026-08-02T00:00:00Z'),
      email: 'customer@example.com',
    });

  it('removes credential fields from direct User response mapper', () => {
    const response = toSafeUserResponse(createSensitiveUser());

    expect(response).not.toHaveProperty('password');
    expect(response).not.toHaveProperty('googleId');
    expect(response).not.toHaveProperty('resetPasswordToken');
    expect(response).not.toHaveProperty('resetPasswordExpires');
    expect(response).toMatchObject({ id: 'user-1', email: 'customer@example.com' });
  });

  it.each([
    ['User', () => createSensitiveUser()],
    [
      'Restaurant owner',
      () => Object.assign(new Restaurant(), { id: 'restaurant-1', owner: createSensitiveUser() }),
    ],
    [
      'Order customer',
      () => Object.assign(new Order(), { id: 'order-1', user: createSensitiveUser() }),
    ],
    [
      'Order shipper',
      () =>
        Object.assign(new Order(), {
          id: 'order-1',
          shippingDetail: Object.assign(new ShippingDetail(), {
            shipper: createSensitiveUser(),
          }),
        }),
    ],
    [
      'Shipper certificate user',
      () =>
        Object.assign(new ShipperCertificateInfo(), {
          id: 'certificate-1',
          user: createSensitiveUser(),
        }),
    ],
  ])('does not serialize credentials for %s', (_label, factory) => {
    const serialized = JSON.stringify(instanceToPlain(factory()));

    expect(serialized).not.toContain('bcrypt-hash');
    expect(serialized).not.toContain('google-subject');
    expect(serialized).not.toContain('reset-token');
    expect(serialized).not.toContain('resetPasswordExpires');
  });
});
