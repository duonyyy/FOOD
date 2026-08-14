/**
 * Immutable payment input supplied by Ordering when a checkout is created.
 * Payments deliberately stores this snapshot instead of reading Order data.
 */
export interface PaymentOrderSnapshot {
  orderId: string;
  amount: number;
  currency: 'VND';
}
