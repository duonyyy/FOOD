import { GeocodingPortAdapter } from './geocoding-port.adapter';

describe('GeocodingPortAdapter', () => {
  it('maps Mapbox coordinates to the public location snapshot', async () => {
    const geocodingService = {
      geocode: jest.fn().mockResolvedValue({ lat: 10.77, lng: 106.69 }),
    };
    const adapter = new GeocodingPortAdapter(geocodingService as never);

    await expect(
      adapter.geocode({
        street: '1 Nguyễn Huệ',
        ward: 'Bến Nghé',
        district: 'Quận 1',
        city: 'Hồ Chí Minh',
      }),
    ).resolves.toEqual({
      latitude: 10.77,
      longitude: 106.69,
      formattedAddress: '1 Nguyễn Huệ, Bến Nghé, Quận 1, Hồ Chí Minh',
    });
  });

  it('preserves provider misses as null instead of inventing coordinates', async () => {
    const geocodingService = { geocode: jest.fn().mockResolvedValue(null) };
    const adapter = new GeocodingPortAdapter(geocodingService as never);

    await expect(
      adapter.geocode({ street: 'Unknown', ward: '', district: '', city: 'HCM' }),
    ).resolves.toBeNull();
  });
});
