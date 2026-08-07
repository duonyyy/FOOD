import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from 'src/entities/address.entity';
import { Food } from 'src/entities/food.entity';
import { Notification } from 'src/entities/notification.entity';
import { Promotion } from 'src/entities/promotion.entity';
import { Restaurant } from 'src/entities/restaurant.entity';
import { Review } from 'src/entities/review.entity';
import { Role } from 'src/entities/role.entity';
import { ShippingDetail } from 'src/entities/shippingDetail.entity';
import { Topping } from 'src/entities/topping.entity';
import { User } from 'src/entities/user.entity';
import { SystemConstraintsModule } from 'src/features/system-constraints/public-api';
import { MapsModule } from 'src/infra/maps/maps.module';
import { PaymentGatewayModule } from 'src/infra/payment-gateways/payment-gateway.module';
import { QueueModule } from 'src/infra/queue/queue.module';
import { StorageModule } from 'src/infra/storage/storage.module';
import { Checkout } from '../entities/checkout.entity';
import { Order } from '../entities/order.entity';
import { OrderDetail } from '../entities/orderDetail.entity';
import { DemoPaymentController, DemoPaymentGuard } from './demo-payment.controller';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      Topping,
      OrderDetail,
      Checkout,
      User,
      Food,
      Role,
      Restaurant,
      Address,
      Promotion,
      Review,
      Notification,
      ShippingDetail,
    ]),
    ConfigModule,
    QueueModule,
    MapsModule,
    StorageModule,
    PaymentGatewayModule,
    SystemConstraintsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [PaymentController, DemoPaymentController],
  providers: [PaymentService, DemoPaymentGuard],
  exports: [PaymentService],
})
export class PaymentModule {}
