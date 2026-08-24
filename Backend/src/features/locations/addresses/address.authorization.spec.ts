import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthGuard } from '../../identity/public-api';
import { AddressController } from './address.controller';

describe('Address authorization policy', () => {
  it('protects every address route with the identity AuthGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AddressController) as unknown[];

    expect(guards).toContain(AuthGuard);
  });

  it('rejects a user-address collection lookup for another actor before service access', () => {
    const service = { getAddresseByUser: jest.fn() };
    const controller = new AddressController(service as never);

    expect(() =>
      controller.getAddressesByUser('customer-b', {
        headers: {},
        user: { id: 'customer-a' },
      }),
    ).toThrow(/another user's addresses/);
    expect(service.getAddresseByUser).not.toHaveBeenCalled();
  });
});
