import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_KEY } from 'src/auth/decorators/permissions.decorator';
import { Permission } from 'src/constants/permission.enum';
import { AuthGuard, RolesGuard } from './public-api';
import { IdentityRoleQueryController } from './roles/identity-role-query.controller';
import { IdentityUserQueryController } from './users/identity-user-query.controller';

interface ControllerClass {
  prototype: object;
}

const permissionProtectedRoutes: ReadonlyArray<[ControllerClass, string, string]> = [
  [IdentityUserQueryController, 'listUsers', Permission.USER.READ],
  [IdentityUserQueryController, 'findOne', Permission.USER.READ],
  [IdentityRoleQueryController, 'listRoles', Permission.ROLE.READ],
  [IdentityRoleQueryController, 'findRole', Permission.ROLE.READ],
];

describe('Identity query authorization policy', () => {
  it('uses AuthGuard and CurrentActor only for the current-profile query', () => {
    const method = Object.getOwnPropertyDescriptor(IdentityUserQueryController.prototype, 'findMe')
      ?.value as unknown;
    const guards = Reflect.getMetadata(GUARDS_METADATA, method as object) as unknown[];

    expect(guards).toContain(AuthGuard);
  });

  it.each(permissionProtectedRoutes)(
    'requires the matching read permission for %p.%s',
    (controller, methodName, permission) => {
      const method = Object.getOwnPropertyDescriptor(controller.prototype, methodName)
        ?.value as unknown;
      const guards = Reflect.getMetadata(GUARDS_METADATA, method as object) as unknown[];
      const permissions = Reflect.getMetadata(PERMISSIONS_KEY, method as object) as string[];

      expect(guards).toContain(RolesGuard);
      expect(permissions).toEqual([permission]);
    },
  );
});
