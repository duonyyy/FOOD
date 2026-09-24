import { compare } from 'bcryptjs';
import { AdminUsersService } from 'src/features/users/users/services/admin-users.service';

describe('AdminUsersService', () => {
  it('uses the selected role and hashes the password when an admin creates a user', async () => {
    const role = { id: 'role-1', name: 'user' };
    const roles = { findOne: jest.fn().mockResolvedValue(role) };
    const users = {
      create: jest.fn((value: unknown) => value),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
      delete: jest.fn(),
    };
    const service = new AdminUsersService(roles as never, users as never);

    const created = await service.create({
      username: 'customer-a',
      password: 'secret-password',
      role: 'role-1',
    } as never);

    expect(roles.findOne).toHaveBeenCalledWith({ where: { id: 'role-1' } });
    expect(created).toMatchObject({ username: 'customer-a', role });
    expect(created.id).toBeTruthy();
    await expect(compare('secret-password', created.password)).resolves.toBe(true);
    expect(users.save).toHaveBeenCalledTimes(1);

    await service.remove(created.id);
    expect(users.delete).toHaveBeenCalledWith(created.id);
  });
});
