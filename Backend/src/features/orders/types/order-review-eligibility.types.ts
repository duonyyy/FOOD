export interface AssertCustomerCanReviewFoodRequest {
  orderId: string;
  customerId: string;
  foodId: string;
}

export interface AssertCustomerCanReviewShipperRequest {
  orderId: string;
  customerId: string;
  shipperId: string;
}
