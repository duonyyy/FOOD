import { BadRequestException } from '@nestjs/common';
import { Checkout, CheckoutStatus } from 'src/entities/checkout.entity';
import { PaymentService } from './payment.service';

describe('Payment callback idempotency characterization', () => {
  let checkout: Checkout;
  let transactionalCheckoutRepository: { findOne: jest.Mock; save: jest.Mock };
  let checkoutRepository: {
    manager: { transaction: jest.Mock };
  };
  let eventBus: { publish: jest.Mock };
  let momoGateway: {
    initialize: jest.Mock;
    verifyWebhookSignature: jest.Mock;
    handleWebhookEvent: jest.Mock;
  };
  let service: PaymentService;

  beforeEach(() => {
    jest.clearAllMocks();
    checkout = Object.assign(new Checkout(), {
      id: 'checkout-1',
      orderId: 'order-1',
      paymentIntentId: 'provider-reference-1',
      amount: 100_000,
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
    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    momoGateway = {
      initialize: jest.fn(),
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
      handleWebhookEvent: jest.fn(),
    };
    service = new PaymentService(
      checkoutRepository as never,
      { get: jest.fn() } as never,
      momoGateway as never,
      {} as never,
      eventBus as never,
    );
  });

  it('processes concurrent callbacks for one provider reference exactly once', async () => {
    await Promise.all([
      service.handlePaymentSuccess('provider-reference-1', 100_000),
      service.handlePaymentSuccess('provider-reference-1', 100_000),
    ]);

    expect(transactionalCheckoutRepository.save).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('does not replay side effects when a completed callback is retried', async () => {
    checkout.status = CheckoutStatus.COMPLETED;

    await service.handlePaymentSuccess('provider-reference-1', 100_000);

    expect(transactionalCheckoutRepository.save).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('rejects a callback amount that differs from checkout/order amount', async () => {
    await expect(
      service.handlePaymentSuccess('provider-reference-1', 90_000),
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
        },
        'valid-signature',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid signature and non-VND callback currency', async () => {
    momoGateway.verifyWebhookSignature.mockReturnValueOnce(false);
    await expect(
      service.handleWebhookEvent(
        { partnerCode: 'MOMO', orderId: 'provider-reference-1', amount: 100_000 },
        'invalid-signature',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    momoGateway.verifyWebhookSignature.mockReturnValueOnce(true);
    await expect(
      service.handleWebhookEvent(
        {
          partnerCode: 'MOMO',
          orderId: 'provider-reference-1',
          amount: 100_000,
          currency: 'USD',
        },
        'valid-signature',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
