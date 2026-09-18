/**
 * Stable order lifecycle values shared at cross-feature boundaries.
 *
 * Transition rules and order state-machine behavior remain owned by Orders.
 */
export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  DELIVERING = 'delivering',
  SHIPPER_RECEIVED = 'shipper_received',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
  PROCESSING_PAYMENT = 'processing_payment',
}
