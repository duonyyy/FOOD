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
