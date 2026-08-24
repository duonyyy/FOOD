import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { Role } from 'src/entities/role.entity';
import { User } from 'src/entities/user.entity';
import { IdentityRoleQueryController } from './identity-role-query.controller';
import { IdentityRoleQueryService } from './identity-role-query.service';

@Module({
  imports: [TypeOrmModule.forFeature([Role, User]), AuthModule],
  controllers: [IdentityRoleQueryController],
  providers: [IdentityRoleQueryService],
})
export class IdentityRoleQueryModule {}
