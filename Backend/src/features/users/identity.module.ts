import { Module } from '@nestjs/common';
import { AuthModule } from 'src/features/auth/auth-module.public-api';
import { RoleModule } from 'src/features/users/roles/role.module';
import { UsersModule } from 'src/features/users/users.module';
import { IdentityRoleQueryModule } from './roles/identity-role-query.module';
import { RoleController } from './roles/role.controller';
import { IdentityUserQueryModule } from './users/identity-user-query.module';
import { UsersController } from './controllers/users.controller';

/**
 * Identity owns User/Role/Permission reads. Legacy modules retain auth and command compatibility.
 */
@Module({
  imports: [AuthModule, RoleModule, UsersModule, IdentityUserQueryModule, IdentityRoleQueryModule],
  controllers: [UsersController, RoleController],
  exports: [AuthModule, IdentityUserQueryModule],
})
export class IdentityModule {}
