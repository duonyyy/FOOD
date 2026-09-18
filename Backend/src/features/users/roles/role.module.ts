// src/roles/role.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from 'src/entities/permission.entity';
import { Role } from 'src/entities/role.entity';
import { User } from 'src/entities/user.entity';
import { RolesService } from './role.service';

@Module({
  imports: [TypeOrmModule.forFeature([Role, User, Permission]), JwtModule],
  providers: [RolesService],
  exports: [RolesService, TypeOrmModule],
})
export class RoleModule {}
