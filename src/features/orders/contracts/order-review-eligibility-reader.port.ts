export const ORDER_REVIEW_ELIGIBILITY_READER = Symbol('ORDER_REVIEW_ELIGIBILITY_READER');

export interface OrderReviewEligibilityReaderPort {
  findReviewEligibility(
    request: FindOrderReviewEligibilityRequest,
  ): Promise<OrderReviewEligibilitySnapshot | null>;
}

export interface FindOrderReviewEligibilityRequest {
  orderId: string;
  customerId: string;
}

export interface OrderReviewEligibilitySnapshot {
  orderId: string;
  customerId: string;
  orderStatus: string | null;
  foodIds: string[];
  shipperId: string | null;
}
