import { MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AuthController } from 'src/features/auth/auth.controller';
import { AuthModule } from 'src/features/auth/auth.module';
import { AuthGuard } from 'src/features/auth/public-api';
import { IdentityModule } from 'src/features/users/public-api';

describe('Identity auth compatibility', () => {
  it('keeps Auth routes separate from the Identity module', () => {
    const authControllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      AuthModule,
    ) as unknown[];

    expect(IdentityModule).toBeDefined();
    expect(AuthGuard).toBeDefined();
    expect(authControllers).toContain(AuthController);
  });

  it.each([
    ['loginWithEmailPassword', 'login/email'],
    ['logout', 'logout'],
    ['register', 'register'],
  ])('keeps the Auth route %s at /auth/%s', (methodName, route) => {
    const method = Object.getOwnPropertyDescriptor(AuthController.prototype, methodName)
      ?.value as unknown;

    expect(Reflect.getMetadata(PATH_METADATA, method as object)).toBe(route);
  });
});
