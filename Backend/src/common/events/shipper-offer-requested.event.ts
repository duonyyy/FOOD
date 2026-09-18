export const SHIPPER_OFFER_REQUESTED_EVENT = 'delivery.shipper-offer-requested';

export interface ShipperOfferRequestedEvent {
  orderId: string;
  targetShipperId: string;
  distanceKm: number;
  priorityScore: number;
  shippingFee: number;
  shipperEarnings: number;
  shipperCommissionRate: number;
  estimatedDeliveryTime: number;
}
