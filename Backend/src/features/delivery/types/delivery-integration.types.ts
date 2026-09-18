export interface DeliveryOrderSnapshot {
  id: string;
  status: string;
  shippingFee?: number | null;
  shipperEarnings?: number | null;
  deliveryDistance?: number | null;
  restaurant?: {
    latitude?: number | string | null;
    longitude?: number | string | null;
  } | null;
  shippingDetail?: unknown;
}

export interface DeliveryQuoteRequest {
  restaurantId: string;
  origin: CoordinateSnapshot;
  destination: CoordinateSnapshot;
}

export interface CoordinateSnapshot {
  latitude: number;
  longitude: number;
}

export interface DeliveryQuoteSnapshot {
  distanceKilometers: number;
  deliveryFee: number;
  estimatedMinutes: number | null;
}
