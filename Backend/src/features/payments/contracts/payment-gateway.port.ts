export type PaymentGatewayProvider = 'momo' | 'vnpay';

export interface PaymentGatewayConfig {
  apiKey?: string;
  secretKey?: string;
  environment: 'sandbox' | 'production';
  webhookSecret?: string;
}

export interface PaymentMethod {
  id: string;
  type: string;
  details: Record<string, unknown>;
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  /** Provider-side transaction id returned by an authoritative status query. */
  providerTransactionId?: string;
  paymentMethod?: PaymentMethod;
  clientSecret?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  error?: string;
  redirectUrl?: string;
  metadata?: Record<string, unknown>;
}

/** Infrastructure adapter contract consumed by the Payments feature. */
export interface PaymentGatewayPort {
  readonly provider: PaymentGatewayProvider;
  initialize(config: PaymentGatewayConfig): void;
  createPaymentIntent(
    orderId: string,
    amount: number,
    currency: string,
    metadata?: Record<string, unknown>,
  ): Promise<PaymentIntent>;
  confirmPaymentIntent(paymentIntentId: string): Promise<PaymentResult>;
  cancelPaymentIntent(paymentIntentId: string): Promise<PaymentResult>;
  refundPayment(paymentIntentId: string, amount?: number): Promise<PaymentResult>;
  getPaymentIntent(paymentIntentId: string): Promise<PaymentIntent>;
  verifyWebhookSignature(payload: Record<string, unknown>, signature: string): boolean;
  handleWebhookEvent(payload: Record<string, unknown>): Promise<void>;
}
