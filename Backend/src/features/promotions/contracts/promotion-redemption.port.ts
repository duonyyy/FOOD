export const PROMOTION_REDEMPTION_PORT = Symbol('PROMOTION_REDEMPTION_PORT');

export interface PromotionRedemptionPort {
  reservePromotion(request: ReservePromotionRequest): Promise<PromotionReservationSnapshot>;
  commitReservation(reservationId: string): Promise<void>;
  releaseReservation(reservationId: string): Promise<void>;
}

export interface ReservePromotionRequest {
  orderId: string;
  promotionCode: string;
  customerId: string;
  subtotal: number;
}

export interface PromotionReservationSnapshot {
  reservationId: string;
  promotionId: string;
  promotionCode: string;
  discountAmount: number;
  expiresAt: Date | null;
}
