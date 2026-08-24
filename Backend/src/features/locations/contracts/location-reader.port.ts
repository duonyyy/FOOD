export const LOCATION_READER = Symbol('LOCATION_READER');

export interface LocationReaderPort {
  findAddress(addressId: string): Promise<AddressSnapshot | null>;
  findTemporaryAddress(addressId: string): Promise<TemporaryAddressSnapshot | null>;
}

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
