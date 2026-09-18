export interface OrderReviewSummaryRequest {
  customerId: string;
  foodIds: readonly string[];
  shipperId: string | null;
}

export interface OrderReviewSummary {
  foodReviews: readonly OrderFoodReview[];
  shipperReview: OrderShipperReview | null;
}

export interface OrderFoodReview {
  id: string;
  foodId: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

export interface OrderShipperReview {
  id: string;
  rating: number;
  comment: string;
  createdAt: Date;
}
