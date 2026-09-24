import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from 'src/entities/role.entity';
import { User } from 'src/entities/user.entity';
import { AuthModule } from 'src/features/auth/auth-module.public-api';
import { LocationsModule } from 'src/features/locations/public-api';
import { IdentityRoleQueryController } from './roles/controllers/identity-role-query.controller';
import { RoleController } from './roles/controllers/role.controller';
import { IdentityRoleQueryService } from './roles/services/identity-role-query.service';
import { UsersModule } from './users.module';
import { AdminUserQueryController } from './users/controllers/admin-user-query.controller';
import { AdminUsersController } from './users/controllers/admin-users.controller';
import { CurrentUserQueryController } from './users/controllers/current-user-query.controller';
import { CurrentUserController } from './users/controllers/current-user.controller';
import { AdminUsersService } from './users/services/admin-users.service';
import { IdentityUserQueryService } from './users/services/identity-user-query.service';
import { UserProfileService } from './users/services/user-profile.service';

/**
 * Identity owns User/Role/Permission HTTP reads and commands.
 * Narrow Users/Profile modules serve Auth and Delivery without a module cycle.
 */
@Module({
  imports: [AuthModule, UsersModule, LocationsModule, TypeOrmModule.forFeature([User, Role])],
  controllers: [
    CurrentUserQueryController,
    CurrentUserController,
    AdminUserQueryController,
    AdminUsersController,
    RoleController,
    IdentityRoleQueryController,
  ],
  providers: [
    IdentityUserQueryService,
    IdentityRoleQueryService,
    UserProfileService,
    AdminUsersService,
  ],
  exports: [IdentityUserQueryService],
})
export class IdentityModule {}
