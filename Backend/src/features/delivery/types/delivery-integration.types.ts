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
  origin: Coordinates;
  destination: Coordinates;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface DeliveryQuote {
  distanceKilometers: number;
  deliveryFee: number;
  estimatedMinutes: number | null;
}
