export interface OrderReviewSummaryRequest {
  customerId: string;
  foodIds: readonly string[];
  shipperId: string | null;
}

export interface OrderReviewSummary {
  foodReviews: readonly OrderFoodReviewSnapshot[];
  shipperReview: OrderShipperReviewSnapshot | null;
}

export interface OrderFoodReviewSnapshot {
  id: string;
  foodId: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

export interface OrderShipperReviewSnapshot {
  id: string;
  rating: number;
  comment: string;
  createdAt: Date;
}
