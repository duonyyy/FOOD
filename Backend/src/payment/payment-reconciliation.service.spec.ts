import { Checkout, CheckoutStatus } from 'src/entities/checkout.entity';
import {
  PaymentReconciliationService,
  type PaymentReconciliationSummary,
} from './payment-reconciliation.service';

describe('PaymentReconciliationService', () => {
  let checkout: Checkout;
  let repository: {
    find: jest.Mock;
    update: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let transactionRepository: { findOne: jest.Mock; save: jest.Mock };
  let paymentService: { reconcilePendingCheckout: jest.Mock };
  let service: PaymentReconciliationService;

  beforeEach(() => {
    checkout = Object.assign(new Checkout(), {
      id: 'checkout-1',
      orderId: 'order-1',
      paymentIntentId: 'provider-1',
      status: CheckoutStatus.PENDING,
      updatedAt: new Date(Date.now() - 30 * 60_000),
      reconciliationAttempts: 0,
      reconciliationLastError: null,
    });
    transactionRepository = {
      findOne: jest.fn(async () => checkout),
      save: jest.fn(async (value) => value),
    };
    repository = {
      find: jest.fn(async () => [checkout]),
      update: jest.fn().mockResolvedValue(undefined),
      manager: {
        transaction: jest.fn(async (callback) =>
          callback({ getRepository: jest.fn(() => transactionRepository) }),
        ),
      },
    };
    paymentService = { reconcilePendingCheckout: jest.fn() };
    service = new PaymentReconciliationService(
      repository as never,
      { get: jest.fn() } as never,
      paymentService as never,
    );
  });

  it('records a provider mismatch without changing checkout status', async () => {
    paymentService.reconcilePendingCheckout.mockResolvedValue({
      status: 'mismatch',
      reason: 'amount_mismatch_or_missing',
    });

    const summary = await service.reconcilePendingPayments();

    expect(summary).toMatchObject({
      scanned: 1,
      attempted: 1,
      mismatches: 1,
      reconciled: 0,
    });
    expect(checkout.status).toBe(CheckoutStatus.PENDING);
    expect(repository.update).toHaveBeenCalledWith('checkout-1', {
      reconciliationLastError: 'amount_mismatch_or_missing',
    });
  });

  it('does not call the provider after the durable retry budget is exhausted', async () => {
    checkout.reconciliationAttempts = 3;

    const summary = await service.reconcilePendingPayments();

    expect(summary).toMatchObject({ scanned: 1, attempted: 0, skipped: 1 });
    expect(paymentService.reconcilePendingCheckout).not.toHaveBeenCalled();
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('records a verified provider success as reconciled', async () => {
    paymentService.reconcilePendingCheckout.mockResolvedValue({
      status: 'reconciled',
      providerTransactionId: 'provider-transaction-1',
    });

    const summary: PaymentReconciliationSummary = await service.reconcilePendingPayments();

    expect(summary.reconciled).toBe(1);
    expect(repository.update).toHaveBeenCalledWith('checkout-1', {
      reconciliationLastError: null,
    });
  });
});
