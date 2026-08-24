export const PAYMENT_SUCCEEDED_EVENT = 'payment.succeeded';

export interface PaymentSucceededEvent {
  orderId: string;
  checkoutId: string;
  paymentId: string | null;
}
