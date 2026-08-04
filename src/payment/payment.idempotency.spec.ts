import { BadRequestException } from '@nestjs/common';
import { Checkout, CheckoutStatus } from 'src/entities/checkout.entity';
import { Order } from 'src/entities/order.entity';
import { pubSub } from 'src/pubsub';
import { PaymentService } from './payment.service';

jest.mock('src/pubsub', () => ({ pubSub: { publish: jest.fn().mockResolvedValue(true) } }));

describe('Payment callback idempotency characterization', () => {
  const mockedPubSub = pubSub as unknown as { publish: jest.Mock };
  let checkout: Checkout;
  let order: Order;
  let transactionalCheckoutRepository: { findOne: jest.Mock; save: jest.Mock };
  let transactionalOrderRepository: { findOne: jest.Mock; save: jest.Mock };
  let orderRepository: { findOne: jest.Mock };
  let checkoutRepository: {
    manager: { transaction: jest.Mock };
  };
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
    order = Object.assign(new Order(), {
      id: 'order-1',
      total: 100_000,
      status: 'processing_payment',
      orderDetails: [],
    });
    transactionalCheckoutRepository = {
      findOne: jest.fn(async () => checkout),
      save: jest.fn(async (value) => value),
    };
    transactionalOrderRepository = {
      findOne: jest.fn(async () => order),
      save: jest.fn(async (value) => value),
    };
    const transactionManager = {
      getRepository: jest.fn((entity) =>
        entity === Checkout ? transactionalCheckoutRepository : transactionalOrderRepository,
      ),
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
    orderRepository = {
      findOne: jest.fn(async () => ({ ...order, orderDetails: [] })),
    };
    momoGateway = {
      initialize: jest.fn(),
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
      handleWebhookEvent: jest.fn(),
    };
    service = new PaymentService(
      orderRepository as never,
      {} as never,
      checkoutRepository as never,
      {} as never,
      {} as never,
      {} as never,
      { get: jest.fn() } as never,
      momoGateway as never,
      {} as never,
      {} as never,
    );
  });

  it('processes concurrent callbacks for one provider reference exactly once', async () => {
    await Promise.all([
      service.handlePaymentSuccess('provider-reference-1', 100_000),
      service.handlePaymentSuccess('provider-reference-1', 100_000),
    ]);

    expect(transactionalCheckoutRepository.save).toHaveBeenCalledTimes(1);
    expect(transactionalOrderRepository.save).toHaveBeenCalledTimes(1);
    expect(orderRepository.findOne).toHaveBeenCalledTimes(1);
    expect(mockedPubSub.publish).toHaveBeenCalledTimes(2);
  });

  it('does not replay side effects when a completed callback is retried', async () => {
    checkout.status = CheckoutStatus.COMPLETED;

    await service.handlePaymentSuccess('provider-reference-1', 100_000);

    expect(transactionalCheckoutRepository.save).not.toHaveBeenCalled();
    expect(transactionalOrderRepository.save).not.toHaveBeenCalled();
    expect(orderRepository.findOne).not.toHaveBeenCalled();
    expect(mockedPubSub.publish).not.toHaveBeenCalled();
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
