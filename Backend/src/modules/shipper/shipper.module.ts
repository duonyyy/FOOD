import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { ShipperCertificateInfo } from 'src/entities/shipperCertificateInfo.entity';
import { ShippingDetail } from 'src/entities/shippingDetail.entity';
import { User } from 'src/entities/user.entity';
import { QueueModule } from 'src/infra/queue/queue.module';
import { UsersModule } from '../users/users.module';
import { ShipperController } from './shipper.controller';
import { ShipperResolver } from './shipper.resolver';
import { ShipperService } from './shipper.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Order, ShippingDetail, ShipperCertificateInfo]),
    UsersModule,
    JwtModule,
    QueueModule,
  ],
  controllers: [ShipperController],
  providers: [ShipperService, ShipperResolver],
  exports: [ShipperService],
})
export class ShipperModule {}
