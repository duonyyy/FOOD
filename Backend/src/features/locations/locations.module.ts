import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from 'src/entities/address.entity';
import { AuthModule } from 'src/features/auth/auth-module.public-api';
import { AddressController } from './addresses/address.controller';
import { AddressService } from './addresses/address.service';

@Module({
  imports: [TypeOrmModule.forFeature([Address]), AuthModule],
  controllers: [AddressController],
  providers: [AddressService],
  exports: [AddressService],
})
export class LocationsModule {}
