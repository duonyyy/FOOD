/**
 * Runtime-safe public DTO contract.
 *
 * Consumers that only need address DTO classes must import this file instead
 * of the feature public API barrel. The latter also exports LocationsModule
 * and would create an application-module cycle during decorator evaluation.
 */
export { CreateAddressDto } from '../addresses/dto/create-address.dto';
export { UpdateAddressDto } from '../addresses/dto/update-address.dto';
