import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from 'src/common/events/events.module';
import { PaymentGatewayModule } from 'src/infra/payment-gateways/payment-gateway.module';
import { Checkout } from '../entities/checkout.entity';
import { DemoPaymentController, DemoPaymentGuard } from './demo-payment.controller';
import { PaymentController } from './payment.controller';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { PaymentService } from './payment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Checkout]),
    EventsModule,
    ConfigModule,
    PaymentGatewayModule,
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
  providers: [PaymentService, PaymentReconciliationService, DemoPaymentGuard],
  exports: [PaymentService],
})
export class PaymentModule {}
