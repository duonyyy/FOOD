import { BadRequestException } from '@nestjs/common';
import { CheckoutStatus } from 'src/entities/checkout.entity';
import {
  assertPaymentStatusTransition,
  canTransitionPaymentStatus,
} from './payment-status-machine';

describe('payment status machine', () => {
  it.each([CheckoutStatus.COMPLETED, CheckoutStatus.FAILED, CheckoutStatus.CANCELLED])(
    'allows PENDING -> %s',
    (next) => {
      expect(canTransitionPaymentStatus(CheckoutStatus.PENDING, next)).toBe(true);
      expect(() => assertPaymentStatusTransition(CheckoutStatus.PENDING, next)).not.toThrow();
    },
  );

  it('rejects terminal state transitions', () => {
    expect(() =>
      assertPaymentStatusTransition(CheckoutStatus.COMPLETED, CheckoutStatus.FAILED),
    ).toThrow(BadRequestException);
  });
});
