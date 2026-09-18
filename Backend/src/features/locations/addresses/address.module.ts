import { Module } from '@nestjs/common';
import { AuthModule } from 'src/features/auth/auth-module.public-api';
import { AddressController } from './address.controller';
import { AddressService } from './address.service';
import { AddressWriteModule } from './address-write.module';

@Module({
  imports: [AddressWriteModule, AuthModule],
  controllers: [AddressController],
  exports: [AddressService],
})
export class AddressModule {}
