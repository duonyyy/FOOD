/**
 * Payment status response interface
 * Represents the status of a payment for an order
 */
export interface PaymentStatusResponse {
  /** Order identifier */
  orderId: string;
  /** Payment status from the checkout state machine */
  status: string;
  /** Server-authoritative amount snapshot captured at checkout creation */
  amount: number;
  /** Currency code (VND, USD, etc.) */
  currency: string;
  /** Checkout identifier */
  checkoutId: string;
  /** Status of the checkout */
  checkoutStatus: string;
  /** Status of the payment intent (if available) */
  paymentIntentStatus?: string;
  /** Payment method used */
  paymentMethod: string;
}
