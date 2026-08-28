import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RolesGuard } from './roles.guard';

class ClassProtectedController {
  handler(): void {}
}

const protectedHandler = (): void => undefined;

describe('RolesGuard authorization characterization', () => {
  const requiredPermission = 'DASHBOARD_READ';
  let request: { headers: { authorization?: string }; user?: { id: string } };
  let usersService: { findOne: jest.Mock };
  let jwtService: { verify: jest.Mock };
  let guard: RolesGuard;
  let context: ExecutionContext;

  beforeEach(() => {
    Reflect.defineMetadata(PERMISSIONS_KEY, [requiredPermission], ClassProtectedController);
    request = { headers: { authorization: 'Bearer valid-token' } };
    usersService = { findOne: jest.fn() };
    jwtService = { verify: jest.fn().mockReturnValue({ sub: 'admin-1' }) };
    guard = new RolesGuard(
      new Reflector(),
      usersService as never,
      jwtService as never,
      { get: jest.fn().mockReturnValue('test-secret') } as never,
    );
    context = {
      getHandler: () => protectedHandler,
      getClass: () => ClassProtectedController,
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;
  });

  it('returns 401 when a protected route has no bearer token', async () => {
    request.headers.authorization = undefined;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns 403 when the actor is authenticated but lacks class-level permission', async () => {
    usersService.findOne.mockResolvedValue({
      role: { name: 'customer', permissions: [] },
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an actor with class-level permission', async () => {
    usersService.findOne.mockResolvedValue({
      role: { name: 'admin', permissions: [{ name: requiredPermission }] },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'admin-1' });
  });
});
