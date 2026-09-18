import { AppCacheService } from 'src/infra/cache/cache.service';

describe('AppCacheService', () => {
  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    scan: jest.fn(),
    unlink: jest.fn(),
    connect: jest.fn(),
    quit: jest.fn(),
  };
  let service: AppCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AppCacheService(redis as never);
  });

  it('fails open when a cache value is malformed', async () => {
    redis.get.mockResolvedValue('{not-json');

    await expect(service.get('food:list')).resolves.toBeNull();
  });

  it('invalidates every scanned cache key and falls back from unlink to del', async () => {
    redis.scan
      .mockResolvedValueOnce(['12', ['restaurant:1', 'restaurant:2']])
      .mockResolvedValueOnce(['0', ['restaurant:3']]);
    redis.unlink.mockRejectedValue(new Error('unlink unavailable'));
    redis.del.mockResolvedValue(1);

    await expect(service.deleteByPattern('restaurant:*')).resolves.toBe(3);

    expect(redis.scan).toHaveBeenNthCalledWith(1, '0', 'MATCH', 'restaurant:*', 'COUNT', 250);
    expect(redis.scan).toHaveBeenNthCalledWith(2, '12', 'MATCH', 'restaurant:*', 'COUNT', 250);
    expect(redis.del).toHaveBeenCalledWith('restaurant:1', 'restaurant:2');
    expect(redis.del).toHaveBeenCalledWith('restaurant:3');
  });
});
