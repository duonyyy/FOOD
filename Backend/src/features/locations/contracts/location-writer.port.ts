export const LOCATION_WRITER = Symbol('LOCATION_WRITER');

export interface CreateAddressPayload {
  street: string;
  ward: string;
  district: string;
  city: string;
  latitude?: number;
  longitude?: number;
}

export interface LocationWriterPort {
  /**
   * Creates a new address and returns the generated address ID
   */
  writeAddress(data: CreateAddressPayload, ownerUserId?: string): Promise<{ addressId: string }>;

  /**
   * Updates an existing address
   */
  modifyAddress(id: string, data: Partial<CreateAddressPayload>): Promise<void>;

  /**
   * Deletes an address
   */
  removeAddress(id: string): Promise<void>;
}
