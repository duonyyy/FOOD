import { BadRequestException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { AuthService } from 'src/features/auth/auth.service';

describe('email login contract', () => {
  it('keeps the existing JWT claims and response aliases for a valid account', async () => {
    const user = {
      id: 'user-1',
      email: 'customer@example.com',
      name: 'Customer',
      password: await hash('secret-password', 4),
      isActive: true,
      role: { id: 'role-1', name: 'user' },
    };
    const users = { findByEmail: jest.fn().mockResolvedValue(user) };
    const roles = { getUserPermissions: jest.fn().mockResolvedValue(['FOOD_READ']) };
    const jwt = { sign: jest.fn().mockReturnValue('jwt-token') };
    const auth = new AuthService(
      users as never,
      roles as never,
      jwt as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(auth.loginWithEmailPassword(user.email, 'secret-password')).resolves.toEqual({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: ['FOOD_READ'],
      },
      accessToken: 'jwt-token',
      token: 'jwt-token',
      message: 'Login successful',
    });
    expect(jwt.sign).toHaveBeenCalledWith(
      {
        sub: 'user-1',
        email: user.email,
        name: user.name,
        role: 'user',
        roleId: 'role-1',
      },
      { expiresIn: '1d' },
    );

    await expect(auth.loginWithEmailPassword(user.email, 'wrong-password')).rejects.toThrow(
      BadRequestException,
    );
    expect(jwt.sign).toHaveBeenCalledTimes(1);
  });
});
