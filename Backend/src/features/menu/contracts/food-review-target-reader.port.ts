export const FOOD_REVIEW_TARGET_READER = Symbol('FOOD_REVIEW_TARGET_READER');

export interface FoodReviewTargetReaderPort {
  findFoodReviewTarget(foodId: string): Promise<FoodReviewTargetSnapshot | null>;
}

export interface FoodReviewTargetSnapshot {
  foodId: string;
  name: string | null;
}
