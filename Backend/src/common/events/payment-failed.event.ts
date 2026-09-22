export const PAYMENT_FAILED_EVENT = 'payment.failed';

export type PaymentFailedEvent = Record<string, unknown> & {
  orderId: string;
  customerId: string | null;
  checkoutId: string;
  paymentId: string | null;
  reason?: string;
};
