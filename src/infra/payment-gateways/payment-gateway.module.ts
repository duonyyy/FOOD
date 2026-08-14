import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MomoPaymentGateway } from './momo-payment.gateway';
import { PaymentGatewayRouter } from './payment-gateway.router';
import { VnpayPaymentGateway } from './vnpay-payment.gateway';

@Module({
  imports: [ConfigModule],
  providers: [MomoPaymentGateway, VnpayPaymentGateway, PaymentGatewayRouter],
  exports: [MomoPaymentGateway, VnpayPaymentGateway, PaymentGatewayRouter],
})
export class PaymentGatewayModule {}
