import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_KEY } from 'src/features/auth/decorators/permissions.decorator';
import { AuthGuard, RolesGuard } from 'src/features/auth/public-api';
import { IdentityRoleQueryController } from 'src/features/users/roles/controllers/identity-role-query.controller';
import { AdminUserQueryController } from 'src/features/users/users/controllers/admin-user-query.controller';
import { CurrentUserQueryController } from 'src/features/users/users/controllers/current-user-query.controller';
import { Permission } from 'src/shared/types/enums/permission.enum';

interface ControllerClass {
  prototype: object;
}

const permissionProtectedRoutes: ReadonlyArray<[ControllerClass, string, string]> = [
  [AdminUserQueryController, 'listUsers', Permission.USER.READ],
  [AdminUserQueryController, 'findOne', Permission.USER.READ],
  [IdentityRoleQueryController, 'listRoles', Permission.ROLE.READ],
  [IdentityRoleQueryController, 'findRole', Permission.ROLE.READ],
];

describe('Identity query authorization policy', () => {
  it('uses AuthGuard and CurrentActor only for the current-profile query', () => {
    const method = Object.getOwnPropertyDescriptor(CurrentUserQueryController.prototype, 'findMe')
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
