import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MomoPaymentGateway } from './momo-payment.gateway';
import { VnpayPaymentGateway } from './vnpay-payment.gateway';

@Module({
  imports: [ConfigModule],
  providers: [MomoPaymentGateway, VnpayPaymentGateway],
  exports: [MomoPaymentGateway, VnpayPaymentGateway],
})
export class PaymentGatewayModule {}
