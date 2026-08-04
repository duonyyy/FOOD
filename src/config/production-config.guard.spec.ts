import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MomoPaymentGateway } from 'src/infra/payment-gateways/momo-payment.gateway';
import { VnpayPaymentGateway } from 'src/infra/payment-gateways/vnpay-payment.gateway';
import { DemoPaymentGuard } from 'src/payment/demo-payment.controller';
import { assertProductionConfiguration } from './production-config.guard';

describe('Production API and credential security', () => {
  const validProduction = {
    NODE_ENV: 'production',
    JWT_SECRET: 'a-long-random-jwt-secret-value',
    DB_PASSWORD: 'a-random-database-password',
    MINIO_SECRET_KEY: 'a-random-minio-password',
  };

  it('allows development compatibility without treating placeholders as production-safe', () => {
    expect(() =>
      assertProductionConfiguration({ NODE_ENV: 'development', JWT_SECRET: 'your_secret_key' }),
    ).not.toThrow();
  });

  it('fails production startup for missing or placeholder platform secrets', () => {
    expect(() =>
      assertProductionConfiguration({ ...validProduction, JWT_SECRET: 'your_secret_key' }),
    ).toThrow(/JWT_SECRET/);
    expect(() =>
      assertProductionConfiguration({ ...validProduction, DB_PASSWORD: undefined }),
    ).toThrow(/DB_PASSWORD/);
  });

  it('accepts non-placeholder production secrets and forbids demo payment', () => {
    expect(() => assertProductionConfiguration(validProduction)).not.toThrow();
    expect(() =>
      assertProductionConfiguration({ ...validProduction, ENABLE_DEMO_PAYMENT: 'true' }),
    ).toThrow(/ENABLE_DEMO_PAYMENT/);
  });

  it('exposes demo payment only when explicitly enabled outside production', () => {
    const enabledGuard = new DemoPaymentGuard(
      new ConfigService({ NODE_ENV: 'development', ENABLE_DEMO_PAYMENT: 'true' }),
    );
    expect(enabledGuard.canActivate({} as never)).toBe(true);

    const productionGuard = new DemoPaymentGuard(
      new ConfigService({ NODE_ENV: 'production', ENABLE_DEMO_PAYMENT: 'true' }),
    );
    expect(() => productionGuard.canActivate({} as never)).toThrow(NotFoundException);
  });

  it('does not start payment gateways with missing production credentials', () => {
    const config = new ConfigService({ NODE_ENV: 'production' });
    const momo = new MomoPaymentGateway(config);
    expect(() => momo.initialize({ apiKey: '', secretKey: '', environment: 'production' })).toThrow(
      /MOMO_ACCESS_KEY/,
    );

    const vnpay = new VnpayPaymentGateway(config);
    expect(() => vnpay.onModuleInit()).toThrow(/VNPAY_TMN_CODE/);
  });
});
