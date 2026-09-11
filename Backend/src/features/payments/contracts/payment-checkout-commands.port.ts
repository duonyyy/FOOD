export const PAYMENT_CHECKOUT_COMMANDS = Symbol('PAYMENT_CHECKOUT_COMMANDS');

export interface PaymentCheckoutCommandsPort {
  cancelPendingCheckoutForOrder(orderId: string): Promise<void>;
}
