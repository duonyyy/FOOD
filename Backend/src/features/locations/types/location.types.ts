export interface AddressSnapshot {
  addressId: string;
  street: string;
  ward: string;
  district: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  isTemporary: boolean;
}

export interface TemporaryAddressSnapshot extends AddressSnapshot {
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
