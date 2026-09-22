export const PAYMENT_SUCCEEDED_EVENT = 'payment.succeeded';

export type PaymentSucceededEvent = Record<string, unknown> & {
  orderId: string;
  customerId: string | null;
  checkoutId: string;
  paymentId: string | null;
};
