import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  PaymentGatewayPort,
  PaymentGatewayProvider,
} from 'src/features/payments/contracts/payment-gateway.port';
import { MomoPaymentGateway } from './momo-payment.gateway';
import { VnpayPaymentGateway } from './vnpay-payment.gateway';

/** Resolves a provider adapter without leaking adapter classes into Payments. */
@Injectable()
export class PaymentGatewayRouter {
  constructor(
    private readonly momo: MomoPaymentGateway,
    private readonly vnpay: VnpayPaymentGateway,
  ) {}

  get(provider: PaymentGatewayProvider): PaymentGatewayPort {
    if (provider === 'momo') {
      return this.momo;
    }
    if (provider === 'vnpay') {
      return this.vnpay;
    }
    throw new BadRequestException(`Unsupported payment method: ${provider}`);
  }
}
