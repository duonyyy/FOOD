# locations

Owner đích: Address, coordinates, geocoding và address snapshot contract. Legacy `src/modules/address` facade đã được xóa; callers dùng `AddressService` qua public API của Locations.

Locations export `AddressService` và giữ `GeocodingPort` cho adapter infrastructure. Không import Address repository từ feature khác.
