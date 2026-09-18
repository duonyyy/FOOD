import { BadRequestException } from '@nestjs/common';
import type { PaymentGatewayProvider } from 'src/infra/payment-gateways/public-api';
import { PaymentGatewayRouter } from 'src/infra/payment-gateways/payment-gateway.router';

describe('PaymentGatewayRouter', () => {
  it('selects the configured concrete gateway without collapsing the multi-provider boundary', () => {
    const momo = {};
    const vnpay = {};
    const router = new PaymentGatewayRouter(momo as never, vnpay as never);

    expect(router.get('momo')).toBe(momo);
    expect(router.get('vnpay')).toBe(vnpay);
  });

  it('rejects an unsupported provider', () => {
    const router = new PaymentGatewayRouter({} as never, {} as never);

    expect(() => router.get('unsupported' as PaymentGatewayProvider)).toThrow(BadRequestException);
  });
});
