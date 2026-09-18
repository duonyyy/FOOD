export interface AssertCustomerCanChatWithShipperRequest {
  orderId: string;
  customerId: string;
  shipperId: string;
}

export interface CustomerShipperChatPartner {
  orderId: string;
  status: string;
  shipperId: string;
}
