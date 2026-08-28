import { BadRequestException } from '@nestjs/common';
import { CheckoutStatus } from 'src/entities/checkout.entity';

const ALLOWED_TRANSITIONS: Readonly<Record<CheckoutStatus, readonly CheckoutStatus[]>> = {
  [CheckoutStatus.PENDING]: [
    CheckoutStatus.COMPLETED,
    CheckoutStatus.FAILED,
    CheckoutStatus.CANCELLED,
  ],
  [CheckoutStatus.COMPLETED]: [],
  [CheckoutStatus.FAILED]: [],
  [CheckoutStatus.CANCELLED]: [],
};

export function assertPaymentStatusTransition(current: CheckoutStatus, next: CheckoutStatus): void {
  if (!ALLOWED_TRANSITIONS[current].includes(next)) {
    throw new BadRequestException(`Payment cannot transition from ${current} to ${next}`);
  }
}

export function canTransitionPaymentStatus(current: CheckoutStatus, next: CheckoutStatus): boolean {
  return ALLOWED_TRANSITIONS[current].includes(next);
}
