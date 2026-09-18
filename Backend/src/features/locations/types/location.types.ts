export interface DeliveryAddress {
  addressId: string;
  street: string;
  ward: string;
  district: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  isTemporary: boolean;
}

export interface TemporaryDeliveryAddress extends DeliveryAddress {
  isTemporary: true;
}

export interface CreateAddressPayload {
  street: string;
  ward: string;
  district: string;
  city: string;
  latitude?: number;
  longitude?: number;
  label?: string;
  isTemporary?: boolean;
}
