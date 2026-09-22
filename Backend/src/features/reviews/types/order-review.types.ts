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

export interface OrderReviewInfo {
  hasReviewedFood: boolean;
  hasReviewedShipper: boolean;
  foodReviews: OrderFoodReview[];
  shipperReview: OrderShipperReview | null;
  canReviewFood: boolean;
  canReviewShipper: boolean;
}
