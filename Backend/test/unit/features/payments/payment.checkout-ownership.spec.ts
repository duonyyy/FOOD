import { NotFoundException } from '@nestjs/common';
import { Checkout, CheckoutStatus } from 'src/entities/checkout.entity';
import { PaymentService } from 'src/features/payments/payment.service';

describe('Payment checkout ownership', () => {
  let checkout: Checkout;
  let checkoutRepository: {
    create: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let gateway: {
    createPaymentIntent: jest.Mock;
    confirmPaymentIntent: jest.Mock;
    cancelPaymentIntent: jest.Mock;
    getPaymentIntent: jest.Mock;
  };
  let service: PaymentService;

  beforeEach(() => {
    checkout = Object.assign(new Checkout(), {
      id: 'checkout-a',
      orderId: 'order-a',
      customerId: 'customer-a',
      amount: 100_000,
      currency: 'VND',
      paymentMethod: 'momo',
      paymentIntentId: 'intent-a',
      status: CheckoutStatus.PENDING,
    });

    checkoutRepository = {
      create: jest.fn((value: Partial<Checkout>) =>
        Object.assign(new Checkout(), value, { id: 'checkout-created' }),
      ),
      findOne: jest.fn().mockResolvedValue(checkout),
      save: jest.fn().mockResolvedValue(checkout),
      manager: { transaction: jest.fn() },
    };
    gateway = {
      createPaymentIntent: jest.fn().mockResolvedValue({
        id: 'intent-created',
        clientSecret: 'https://provider.example/checkout',
        amount: 100_000,
        currency: 'VND',
        status: 'PENDING',
      }),
      confirmPaymentIntent: jest.fn().mockResolvedValue({ success: true }),
      cancelPaymentIntent: jest.fn().mockResolvedValue({ success: true }),
      getPaymentIntent: jest.fn().mockResolvedValue({
        status: 'pending',
        amount: 100_000,
        currency: 'VND',
      }),
    };
    service = new PaymentService(
      checkoutRepository as never,
      { get: jest.fn() } as never,
      { get: jest.fn().mockReturnValue(gateway) } as never,
      { enqueue: jest.fn(), dispatchAfterCommit: jest.fn() } as never,
    );
  });

  it('copies the authenticated customer into the checkout ownership snapshot', async () => {
    const createdCheckout = await service.createCheckout(
      {
        orderId: 'order-created',
        customerId: 'customer-a',
        amount: 100_000,
        currency: 'VND',
      },
      'momo',
    );

    expect(checkoutRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-created',
        customerId: 'customer-a',
        amount: 100_000,
        currency: 'VND',
      }),
    );
    expect(createdCheckout.customerId).toBe('customer-a');
  });

  it('rejects processing another customer checkout before calling the provider', async () => {
    await expect(service.processPayment('checkout-a', 'customer-b', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(gateway.confirmPaymentIntent).not.toHaveBeenCalled();
    expect(checkoutRepository.save).not.toHaveBeenCalled();
  });

  it('rejects cancelling another customer checkout before calling the provider', async () => {
    await expect(service.cancelCheckout('checkout-a', 'customer-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(gateway.cancelPaymentIntent).not.toHaveBeenCalled();
    expect(checkoutRepository.save).not.toHaveBeenCalled();
  });

  it('returns the persisted checkout status for its owner', async () => {
    checkout.status = CheckoutStatus.FAILED;

    await expect(service.getCheckoutStatus('checkout-a', 'customer-a')).resolves.toEqual({
      orderId: 'order-a',
      status: CheckoutStatus.FAILED,
      amount: 100_000,
      currency: 'VND',
      checkoutId: 'checkout-a',
      checkoutStatus: CheckoutStatus.FAILED,
      paymentMethod: 'momo',
    });
  });

  it('rejects provider status lookup for another customer order', async () => {
    await expect(service.checkMomoStatus('order-a', 'customer-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(gateway.getPaymentIntent).not.toHaveBeenCalled();
  });

  it('rejects VNPAY status lookup for another customer order', async () => {
    await expect(
      service.checkPaymentStatus('order-a', 'customer-b', 'vnpay'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(gateway.getPaymentIntent).not.toHaveBeenCalled();
  });
});
