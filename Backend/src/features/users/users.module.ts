import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from 'src/entities/permission.entity';
import { Role } from 'src/entities/role.entity';
import { User } from 'src/entities/user.entity';
import { RolesService } from './roles/services/role.service';
import { UsersService } from './users/services/users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Permission])],
  providers: [UsersService, RolesService],
  exports: [UsersService, RolesService],
})
export class UsersModule {}
