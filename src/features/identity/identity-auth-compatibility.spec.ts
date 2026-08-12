import { MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AuthController } from 'src/auth/auth.controller';
import { AuthModule } from 'src/auth/auth.module';
import { IdentityModule } from './identity.module';

describe('Identity auth compatibility', () => {
  it('keeps the existing Auth module composed by Identity', () => {
    const identityImports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      IdentityModule,
    ) as unknown[];
    const authControllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      AuthModule,
    ) as unknown[];

    expect(identityImports).toContain(AuthModule);
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
