export const GEOCODING_PORT = Symbol('GEOCODING_PORT');

export interface GeocodingPort {
  geocode(request: GeocodeAddressRequest): Promise<GeocodingSnapshot | null>;
}

export interface GeocodeAddressRequest {
  street: string;
  ward: string;
  district: string;
  city: string;
}

export interface GeocodingSnapshot {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}
