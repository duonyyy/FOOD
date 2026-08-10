# locations

Owner đích: Address, coordinates, geocoding và address snapshot contract. Compatibility implementation: `src/modules/address`.

T2.3 exports `LocationReaderPort` and `GeocodingPort`; T3.2 binds the geocoding adapter and owns Address persistence. Không import Address repository từ feature khác.
