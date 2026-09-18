import { MapboxService } from 'src/infra/mapbox/mapbox.service';

describe('MapboxService fallback', () => {
  const previousToken = process.env.MAPBOX_ACCESS_TOKEN;

  beforeEach(() => {
    // Valid non-secret token shape; no request is made because the provider call is mocked.
    process.env.MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoidGVzdCJ9';
  });

  afterAll(() => {
    if (previousToken === undefined) {
      delete process.env.MAPBOX_ACCESS_TOKEN;
    } else {
      process.env.MAPBOX_ACCESS_TOKEN = previousToken;
    }
  });

  it('returns a deterministic haversine route when Mapbox is unavailable', async () => {
    const service = new MapboxService();
    jest.spyOn(service, 'getDistanceAndDurationFromMapbox').mockResolvedValue(null);

    await expect(service.calculateBikeRoute(0, 0, 0, 1)).resolves.toEqual({
      distance: 111.19,
      duration: 20014,
      route: null,
    });
  });
});
