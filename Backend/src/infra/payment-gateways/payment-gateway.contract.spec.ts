import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { MomoPaymentGateway } from './momo-payment.gateway';
import { VnpayPaymentGateway } from './vnpay-payment.gateway';

jest.mock('axios', () => {
  const request = jest.fn() as jest.Mock & {
    post: jest.Mock;
    isAxiosError: (error: unknown) => boolean;
  };
  request.post = jest.fn();
  request.isAxiosError = (error: unknown) =>
    Boolean(
      typeof error === 'object' && error !== null && (error as { isAxiosError?: boolean }).isAxiosError,
    );
  return { __esModule: true, default: request };
});

const axiosRequest = axios as unknown as jest.Mock & { post: jest.Mock };

describe('payment gateway port contracts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('maps a MoMo create request, applies a timeout and verifies its webhook signature', async () => {
    const gateway = new MomoPaymentGateway(
      new ConfigService({
        MOMO_ACCESS_KEY: 'access-key',
        MOMO_SECRET_KEY: 'secret-key',
        MOMO_PARTNER_CODE: 'partner-code',
        PAYMENT_GATEWAY_TIMEOUT_MS: '3456',
      }),
    );
    gateway.initialize({ environment: 'sandbox' });
    axiosRequest.mockResolvedValue({
      data: { orderId: 'provider-ref', requestId: 'request-1', payUrl: 'https://provider/pay?token=x' },
    });

    const intent = await gateway.createPaymentIntent('order-1', 120_000, 'VND', {
      redirectUrl: 'https://app.example/payment-result',
      ipnUrl: 'https://api.example/payment-webhook',
    });

    const request = axiosRequest.mock.calls[0][0];
    const body = JSON.parse(request.data);
    expect(request.timeout).toBe(3456);
    expect(body).toMatchObject({
      partnerCode: 'partner-code',
      orderId: 'order-1',
      amount: 120_000,
      redirectUrl: 'https://app.example/payment-result',
      ipnUrl: 'https://api.example/payment-webhook',
    });
    expect(intent.clientSecret).toBe('https://provider/pay?token=x');
    expect(intent.metadata).not.toHaveProperty('payUrl');

    const webhookPayload = {
      orderId: 'order-1',
      partnerCode: 'partner-code',
      requestId: 'request-1',
    };
    const raw = 'accessKey=access-key&orderId=order-1&partnerCode=partner-code&requestId=request-1';
    const signature = crypto.createHmac('sha256', 'secret-key').update(raw).digest('hex');
    expect(gateway.verifyWebhookSignature(webhookPayload, signature)).toBe(true);
    expect(gateway.verifyWebhookSignature(webhookPayload, 'incorrect')).toBe(false);
  });

  it('fails fast for missing MoMo credentials and maps a provider timeout as retryable', async () => {
    const missing = new MomoPaymentGateway(new ConfigService());
    missing.initialize({ environment: 'sandbox' });
    await expect(missing.createPaymentIntent('order-1', 1, 'VND')).rejects.toMatchObject({
      code: 'CONFIGURATION_MISSING',
      retryable: false,
    });

    const gateway = new MomoPaymentGateway(
      new ConfigService({
        MOMO_ACCESS_KEY: 'access-key',
        MOMO_SECRET_KEY: 'secret-key',
        MOMO_PARTNER_CODE: 'partner-code',
      }),
    );
    gateway.initialize({ environment: 'sandbox' });
    axiosRequest.mockRejectedValue({ isAxiosError: true, code: 'ECONNABORTED' });

    await expect(gateway.createPaymentIntent('order-1', 1, 'VND')).rejects.toMatchObject({
      code: 'TIMEOUT',
      retryable: true,
    });
  });

  it('maps authoritative MoMo query evidence for reconciliation', async () => {
    const gateway = new MomoPaymentGateway(
      new ConfigService({
        MOMO_ACCESS_KEY: 'access-key',
        MOMO_SECRET_KEY: 'secret-key',
        MOMO_PARTNER_CODE: 'partner-code',
      }),
    );
    gateway.initialize({ environment: 'sandbox' });
    axiosRequest.post.mockResolvedValue({
      data: {
        resultCode: '0',
        amount: 120_000,
        currency: 'VND',
        orderId: 'provider-ref',
        orderInfo: 'order-1',
        transId: 'transaction-1',
      },
    });

    await expect(gateway.getPaymentIntent('provider-ref')).resolves.toMatchObject({
      id: 'provider-ref',
      amount: 120_000,
      currency: 'VND',
      status: 'SUCCEEDED',
      providerTransactionId: 'transaction-1',
      metadata: { orderId: 'order-1', providerReference: 'provider-ref' },
    });
  });

  it('maps and signs a VNPAY request through the same port without persisting a payment URL', async () => {
    const gateway = new VnpayPaymentGateway(
      new ConfigService({
        VNPAY_TMN_CODE: 'TMNCODE',
        VNPAY_HASH_SECRET: 'hash-secret',
        VNPAY_RETURN_URL: 'https://app.example/vnpay-return',
      }),
    );
    gateway.onModuleInit();

    const intent = await gateway.createPaymentIntent('order-2', 50_000, 'VND', {
      ipAddress: '127.0.0.1',
    });
    const url = new URL(intent.clientSecret as string);
    const params = Object.fromEntries(url.searchParams.entries());
    const signature = params.vnp_SecureHash;
    delete params.vnp_SecureHash;

    expect(url.searchParams.get('vnp_TmnCode')).toBe('TMNCODE');
    expect(url.searchParams.get('vnp_Amount')).toBe('5000000');
    expect(gateway.verifyWebhookSignature(params, signature)).toBe(true);
    expect(intent.metadata).not.toHaveProperty('paymentUrl');
  });

  it('fails fast for VNPAY credentials at payment creation', async () => {
    const gateway = new VnpayPaymentGateway(new ConfigService());
    gateway.onModuleInit();

    await expect(gateway.createPaymentIntent('order-2', 1, 'VND')).rejects.toMatchObject({
      code: 'CONFIGURATION_MISSING',
      retryable: false,
    });
  });
});
