import { Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from 'src/entities/address.entity';
import { Role } from 'src/entities/role.entity';
import { User } from 'src/entities/user.entity';
import { ShipperProfileModule } from 'src/features/delivery/shipper-profile.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Address]), JwtModule, ShipperProfileModule],
  controllers: [UsersController],
  providers: [UsersService, JwtService],
  exports: [UsersService],
})
export class UsersModule {}
