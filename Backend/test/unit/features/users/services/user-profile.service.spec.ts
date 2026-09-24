import { compare } from 'bcryptjs';
import { UserProfileService } from 'src/features/users/users/services/user-profile.service';

describe('UserProfileService', () => {
  it('keeps the self/admin update sequence, owned address write, and safe re-query', async () => {
    const user = { id: 'user-1', name: 'Old', password: 'old-hash' };
    const updated = { ...user, name: 'New', address: [{ id: 'address-1' }] };
    const users = {
      findOne: jest.fn().mockResolvedValueOnce(user).mockResolvedValueOnce(updated),
      save: jest.fn().mockResolvedValue(user),
    };
    const addresses = { replaceOwnedAddresses: jest.fn().mockResolvedValue(undefined) };
    const service = new UserProfileService(users as never, addresses as never);
    const replacement = [{ street: 'Main Street' }];

    await expect(
      service.update('user-1', {
        name: 'New',
        password: 'new-password',
        addresses: replacement,
      } as never),
    ).resolves.toEqual(updated);

    expect(users.findOne).toHaveBeenNthCalledWith(1, {
      where: { id: 'user-1' },
      relations: ['address'],
    });
    expect(addresses.replaceOwnedAddresses).toHaveBeenCalledWith('user-1', replacement);
    expect(users.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'New' }));
    expect(user.password).not.toBe('new-password');
    await expect(compare('new-password', user.password)).resolves.toBe(true);
    expect(addresses.replaceOwnedAddresses.mock.invocationCallOrder[0]).toBeLessThan(
      users.save.mock.invocationCallOrder[0],
    );
    expect(users.findOne).toHaveBeenCalledTimes(2);
  });
});
