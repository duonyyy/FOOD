import { Address } from 'src/entities/address.entity';
import { AddressResponseDto } from './dto/address-response.dto';

export function toAddressResponse(address: Address): AddressResponseDto {
  return {
    id: address.id,
    street: address.street,
    ward: address.ward ?? null,
    district: address.district ?? null,
    city: address.city,
    latitude: address.latitude ?? null,
    longitude: address.longitude ?? null,
    isDefault: Boolean(address.isDefault),
    label: address.label ?? null,
    isTemporary: Boolean(address.isTemporary),
    createdAt: address.createdAt ?? null,
  };
}
