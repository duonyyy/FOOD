# locations

Owner đích: Address, coordinates, geocoding và address snapshot contract. Legacy `src/modules/address` facade đã được xóa; callers dùng public Location contract hoặc implementation Locations thuộc owner.

T2.3 exports `LocationReaderPort` and `GeocodingPort`; T3.2 binds the geocoding adapter and owns Address persistence. Không import Address repository từ feature khác.
