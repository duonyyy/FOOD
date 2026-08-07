export const DELIVERY_QUOTE_PORT = Symbol('DELIVERY_QUOTE_PORT');

export interface DeliveryQuotePort {
  quoteDelivery(request: DeliveryQuoteRequest): Promise<DeliveryQuoteSnapshot>;
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
