import { Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from 'src/entities/role.entity';
import { User } from 'src/entities/user.entity';
import { AddressWriteModule } from 'src/features/locations/address-write.public-api';
import { UsersService } from './services/users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role]), AddressWriteModule, JwtModule],
  providers: [UsersService, JwtService],
  exports: [UsersService],
})
export class UsersModule {}
