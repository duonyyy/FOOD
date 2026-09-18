export interface DeliveryDispatchCandidate {
  orderId: string;
  restaurantLocation: {
    latitude: number;
    longitude: number;
  } | null;
  shippingFee: number | null;
  shipperEarnings: number | null;
  deliveryDistance: number | null;
  shipperCommissionRate: number | null;
  estimatedDeliveryTime: number | null;
}
