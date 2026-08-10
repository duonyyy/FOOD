import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { RoleModule } from '../../modules/role/role.module';
import { UsersModule } from '../../modules/users/users.module';

/**
 * Compatibility shell. Identity implementation still lives in legacy modules
 * until a later vertical slice moves it behind this feature boundary.
 */
@Module({
  imports: [AuthModule, RoleModule, UsersModule],
  exports: [AuthModule],
})
export class IdentityModule {}
