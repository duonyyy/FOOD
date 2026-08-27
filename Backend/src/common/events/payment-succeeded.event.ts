export const PAYMENT_SUCCEEDED_EVENT = 'payment.succeeded';

export type PaymentSucceededEvent = Record<string, unknown> & {
  orderId: string;
  checkoutId: string;
  paymentId: string | null;
};
