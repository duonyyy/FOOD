import { BadRequestException } from '@nestjs/common';
import { Checkout, CheckoutStatus } from 'src/entities/checkout.entity';
import { PaymentStatus } from 'src/features/payments/contracts/payment-gateway.port';
import { PaymentService } from './payment.service';

describe('Payment callback idempotency characterization', () => {
  let checkout: Checkout;
  let transactionalCheckoutRepository: { findOne: jest.Mock; save: jest.Mock };
  let checkoutRepository: {
    manager: { transaction: jest.Mock };
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let outboxService: { enqueue: jest.Mock; dispatchAfterCommit: jest.Mock };
  let momoGateway: {
    verifyWebhookSignature: jest.Mock;
    handleWebhookEvent: jest.Mock;
    confirmPaymentIntent: jest.Mock;
    getPaymentIntent: jest.Mock;
  };
  let gatewayRouter: { get: jest.Mock };
  let service: PaymentService;

  beforeEach(() => {
    jest.clearAllMocks();
    checkout = Object.assign(new Checkout(), {
      id: 'checkout-1',
      orderId: 'order-1',
      paymentIntentId: 'provider-reference-1',
      amount: 100_000,
      currency: 'VND',
      paymentMethod: 'momo',
      status: CheckoutStatus.PENDING,
    });
    transactionalCheckoutRepository = {
      findOne: jest.fn(async () => checkout),
      save: jest.fn(async (value) => value),
    };
    const transactionManager = {
      getRepository: jest.fn(() => transactionalCheckoutRepository),
    };
    let transactionTail: Promise<unknown> = Promise.resolve();
    checkoutRepository = {
      findOne: jest.fn(async () => checkout),
      save: jest.fn(async (value) => value),
      manager: {
        transaction: jest.fn((callback) => {
          const result = transactionTail.then(() => callback(transactionManager));
          transactionTail = result.then(
            () => undefined,
            () => undefined,
          );
          return result;
        }),
      },
    };
    outboxService = {
      enqueue: jest.fn().mockResolvedValue({ id: 'outbox-payment-1' }),
      dispatchAfterCommit: jest.fn().mockResolvedValue(undefined),
    };
    momoGateway = {
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
      handleWebhookEvent: jest.fn(),
      confirmPaymentIntent: jest.fn().mockResolvedValue({ success: true }),
      getPaymentIntent: jest.fn(),
    };
    gatewayRouter = { get: jest.fn().mockReturnValue(momoGateway) };
    service = new PaymentService(
      checkoutRepository as never,
      { get: jest.fn() } as never,
      gatewayRouter as never,
      outboxService as never,
    );
  });

  it('processes concurrent callbacks for one provider reference exactly once', async () => {
    const callback = momoCallback();
    const acknowledgements = await Promise.all([
      service.handleWebhookEvent(callback, 'valid-signature'),
      service.handleWebhookEvent(callback, 'valid-signature'),
    ]);

    expect(transactionalCheckoutRepository.save).toHaveBeenCalledTimes(1);
    expect(outboxService.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'payment.succeeded',
        idempotencyKey: 'Checkout:checkout-1:payment:succeeded',
      }),
    );
    expect(outboxService.enqueue).toHaveBeenCalledTimes(1);
    expect(outboxService.dispatchAfterCommit).toHaveBeenCalledTimes(1);
    expect(acknowledgements.map((item) => item.duplicate).sort()).toEqual([false, true]);
  });

  it('does not replay side effects when a completed callback is retried', async () => {
    checkout.status = CheckoutStatus.COMPLETED;
    checkout.providerTransactionId = 'provider-transaction-1';
    checkout.webhookIdempotencyKey = 'momo:provider-transaction-1';

    const acknowledgement = await service.handleWebhookEvent(momoCallback(), 'valid-signature');

    expect(transactionalCheckoutRepository.save).not.toHaveBeenCalled();
    expect(outboxService.enqueue).not.toHaveBeenCalled();
    expect(outboxService.dispatchAfterCommit).not.toHaveBeenCalled();
    expect(acknowledgement).toEqual({
      acknowledged: true,
      duplicate: true,
      outcome: 'succeeded',
    });
  });

  it('rejects a callback amount that differs from checkout/order amount', async () => {
    await expect(
      service.handleWebhookEvent({ ...momoCallback(), amount: 90_000 }, 'valid-signature'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transactionalCheckoutRepository.save).not.toHaveBeenCalled();
  });

  it('rejects inconsistent success type and failed provider result code', async () => {
    await expect(
      service.handleWebhookEvent(
        {
          partnerCode: 'MOMO',
          type: 'payment_intent.succeeded',
          resultCode: '1',
          orderId: 'provider-reference-1',
          amount: 100_000,
          transId: 'provider-transaction-1',
        },
        'valid-signature',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid signature and non-VND callback currency', async () => {
    momoGateway.verifyWebhookSignature.mockReturnValueOnce(false);
    await expect(
      service.handleWebhookEvent(
        { ...momoCallback(), transId: 'provider-transaction-invalid-signature' },
        'invalid-signature',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    momoGateway.verifyWebhookSignature.mockReturnValueOnce(true);
    await expect(
      service.handleWebhookEvent(
        {
          ...momoCallback(),
          currency: 'USD',
        },
        'valid-signature',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses the signed VNPAY callback for the same guarded transition', async () => {
    checkout.paymentMethod = 'vnpay';
    checkout.paymentIntentId = 'vnpay-provider-reference-1';
    const vnpayGateway = {
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
      handleWebhookEvent: jest.fn(),
    };
    gatewayRouter.get.mockReturnValue(vnpayGateway);

    const acknowledgement = await service.handleVnpayWebhook({
      vnp_SecureHash: 'valid-signature',
      vnp_TxnRef: 'vnpay-provider-reference-1',
      vnp_OrderInfo: 'order-1',
      vnp_TransactionNo: 'vnpay-transaction-1',
      vnp_Amount: '10000000',
      vnp_CurrCode: 'VND',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
    });

    expect(vnpayGateway.verifyWebhookSignature).toHaveBeenCalled();
    expect(acknowledgement).toEqual({
      acknowledged: true,
      duplicate: false,
      outcome: 'succeeded',
    });
  });

  it('stores a verified failed payment as a PaymentFailed outbox event', async () => {
    const acknowledgement = await service.handleWebhookEvent(
      {
        ...momoCallback(),
        type: 'payment_intent.failed',
        resultCode: '1',
      },
      'valid-signature',
    );

    expect(acknowledgement).toEqual({
      acknowledged: true,
      duplicate: false,
      outcome: 'failed',
    });
    expect(checkout.status).toBe(CheckoutStatus.FAILED);
    expect(outboxService.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'payment.failed',
        idempotencyKey: 'Checkout:checkout-1:payment:failed',
        payload: expect.objectContaining({ orderId: 'order-1', checkoutId: 'checkout-1' }),
      }),
    );
  });

  it('does not mark a checkout paid from an authenticated client process request', async () => {
    await service.processPayment('checkout-1', { metadata: { bankCode: 'NCB' } });

    expect(checkout.status).toBe(CheckoutStatus.PENDING);
    expect(outboxService.enqueue).not.toHaveBeenCalled();
    expect(checkoutRepository.save).toHaveBeenCalledWith(checkout);
  });

  it('reconciles provider success only when all provider evidence matches', async () => {
    momoGateway.getPaymentIntent.mockResolvedValue({
      id: 'provider-reference-1',
      amount: 100_000,
      currency: 'VND',
      status: PaymentStatus.SUCCEEDED,
      providerTransactionId: 'provider-transaction-reconciled',
      metadata: { orderId: 'order-1' },
    });

    const result = await service.reconcilePendingCheckout('checkout-1');

    expect(result).toEqual({
      status: 'reconciled',
      providerTransactionId: 'provider-transaction-reconciled',
    });
    expect(checkout.status).toBe(CheckoutStatus.COMPLETED);
    expect(outboxService.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'payment.succeeded' }),
    );
  });

  it('leaves the checkout pending when provider success lacks verified amount', async () => {
    momoGateway.getPaymentIntent.mockResolvedValue({
      id: 'provider-reference-1',
      amount: 0,
      currency: 'VND',
      status: PaymentStatus.SUCCEEDED,
      providerTransactionId: 'provider-transaction-without-amount',
      metadata: { orderId: 'order-1' },
    });

    const result = await service.reconcilePendingCheckout('checkout-1');

    expect(result).toEqual({ status: 'mismatch', reason: 'amount_mismatch_or_missing' });
    expect(checkout.status).toBe(CheckoutStatus.PENDING);
    expect(outboxService.enqueue).not.toHaveBeenCalled();
    expect(transactionalCheckoutRepository.save).not.toHaveBeenCalled();
  });
});

function momoCallback(): Record<string, unknown> {
  return {
    partnerCode: 'MOMO',
    type: 'payment_intent.succeeded',
    resultCode: '0',
    orderId: 'provider-reference-1',
    requestId: 'request-1',
    transId: 'provider-transaction-1',
    amount: 100_000,
    currency: 'VND',
    orderInfo: 'order-1',
  };
}
