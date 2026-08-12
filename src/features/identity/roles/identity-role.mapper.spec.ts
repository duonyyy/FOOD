import { toIdentityRoleDetailResponse } from './identity-role.mapper';

describe('Identity role response mapper', () => {
  it('returns safe user summaries rather than User entities with credentials', () => {
    const role = {
      id: 'role-1',
      name: 'administrator',
      displayName: 'Administrator',
      description: null,
      isSystem: true,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
      permissions: [{ id: 'permission-1', name: 'USER_READ', description: null, isActive: true }],
      users: [
        {
          id: 'user-1',
          name: 'Admin',
          email: 'admin@example.com',
          createdAt: new Date('2026-01-01'),
          lastLoginAt: null,
          password: 'hash',
          resetPasswordToken: 'reset-secret',
        },
      ],
    };

    const response = toIdentityRoleDetailResponse(role as never, 1);

    expect(response.users).toEqual([
      expect.objectContaining({ id: 'user-1', email: 'admin@example.com' }),
    ]);
    expect(response.users[0]).not.toHaveProperty('password');
    expect(response.users[0]).not.toHaveProperty('resetPasswordToken');
    expect(response.permissions).toEqual([
      { id: 'permission-1', name: 'USER_READ', description: null, isActive: true },
    ]);
  });
});
