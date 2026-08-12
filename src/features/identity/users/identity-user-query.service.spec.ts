import { IdentityUserQueryService } from './identity-user-query.service';

describe('IdentityUserQueryService', () => {
  it('maps a current user to a safe response without credential fields', async () => {
    const user = {
      id: 'user-1',
      username: 'an',
      email: 'an@example.com',
      name: 'An',
      phone: '0900000000',
      avatar: null,
      isActive: true,
      birthday: new Date('2000-01-01'),
      createdAt: new Date('2026-01-01'),
      lastLoginAt: null,
      authProvider: 'email',
      password: 'hash',
      googleId: 'google-secret',
      resetPasswordToken: 'reset-secret',
      resetPasswordExpires: new Date('2026-02-01'),
      role: { id: 'role-1', name: 'user', displayName: 'Customer' },
      address: [
        {
          id: 'address-1',
          street: '1 Main Street',
          ward: 'Ward 1',
          district: 'District 1',
          city: 'HCM',
          label: 'Home',
          isDefault: true,
          isTemporary: false,
        },
        {
          id: 'temporary-address',
          street: 'Temporary street',
          ward: 'Ward 2',
          district: 'District 2',
          city: 'HCM',
          label: 'Temporary',
          isDefault: false,
          isTemporary: true,
        },
      ],
    };
    const repository = { findOne: jest.fn().mockResolvedValue(user) };
    const service = new IdentityUserQueryService(repository as never);

    const response = await service.findCurrentUser('user-1');

    expect(response).toMatchObject({
      id: 'user-1',
      username: 'an',
      role: { id: 'role-1', name: 'user' },
    });
    expect(response).not.toHaveProperty('password');
    expect(response).not.toHaveProperty('googleId');
    expect(response).not.toHaveProperty('resetPasswordToken');
    expect(response).not.toHaveProperty('resetPasswordExpires');
    expect(response.addresses).toEqual([expect.objectContaining({ id: 'address-1' })]);
  });

  it('exports a scalar cross-feature snapshot instead of a User entity', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'user-1',
        username: 'an',
        name: 'An',
        isActive: true,
        role: { name: 'administrator' },
      }),
    };
    const service = new IdentityUserQueryService(repository as never);

    await expect(service.findIdentityUser('user-1')).resolves.toEqual({
      userId: 'user-1',
      username: 'an',
      name: 'An',
      roleName: 'administrator',
      isActive: true,
    });
  });
});
