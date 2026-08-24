// src/roles/role.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from 'src/entities/permission.entity';
import { Role } from 'src/entities/role.entity';
import { User } from 'src/entities/user.entity';
import { UsersModule } from 'src/modules/users/users.module';
import { RoleController } from './role.controller';
import { RolesService } from './role.service';

@Module({
  imports: [TypeOrmModule.forFeature([Role, User, Permission]), JwtModule, UsersModule],
  providers: [RolesService],
  controllers: [RoleController],
  exports: [RolesService, TypeOrmModule],
})
export class RoleModule {}
