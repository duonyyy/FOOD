import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { RoleModule } from 'src/modules/role/role.module';
import { UsersModule } from 'src/modules/users/users.module';
import { IdentityRoleQueryModule } from './roles/identity-role-query.module';
import { IdentityUserQueryModule } from './users/identity-user-query.module';

/**
 * Identity owns User/Role/Permission reads. Legacy modules retain auth and command compatibility.
 */
@Module({
  imports: [AuthModule, RoleModule, UsersModule, IdentityUserQueryModule, IdentityRoleQueryModule],
  exports: [AuthModule, IdentityUserQueryModule],
})
export class IdentityModule {}
