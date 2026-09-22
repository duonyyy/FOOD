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

export interface GetOrderReviewContextRequest {
  orderId: string;
  actorId: string;
  actorRole?: string;
}

export interface OrderReviewContext {
  customerId: string;
  foodIds: string[];
  shipperId: string | null;
  status: string;
}
