export type VerifiedPaymentOutcome = 'succeeded' | 'failed';

/** Stable provider acknowledgement. Replays return a successful no-op response. */
export interface PaymentWebhookAcknowledgement {
  acknowledged: true;
  duplicate: boolean;
  outcome: VerifiedPaymentOutcome;
}
