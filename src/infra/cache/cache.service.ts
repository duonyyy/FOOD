import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { CACHE_TTL_JITTER_MAX_SECONDS, REDIS_CLIENT } from './cache.constants';

@Injectable()
export class AppCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppCacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.redis.connect();
      this.logger.log('Redis cache connected');
    } catch (error) {
      this.logger.error(`Redis cache connection failed: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch (error) {
      this.logger.warn(`Cache get failed for ${key}: ${(error as Error).message}`);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      const ttlWithJitter = ttlSeconds + this.getTtlJitterSeconds();
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlWithJitter);
    } catch (error) {
      this.logger.warn(`Cache set failed for ${key}: ${(error as Error).message}`);
    }
  }

  async remember<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await loader();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.warn(`Cache delete failed for ${key}: ${(error as Error).message}`);
    }
  }

  async deleteByPattern(pattern: string): Promise<number> {
    let deleted = 0;
    let cursor = '0';

    try {
      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 250);
        cursor = nextCursor;

        if (keys.length > 0) {
          deleted += keys.length;
          await this.redis.unlink(...keys).catch(() => this.redis.del(...keys));
        }
      } while (cursor !== '0');
    } catch (error) {
      this.logger.warn(`Cache pattern delete failed for ${pattern}: ${(error as Error).message}`);
    }

    return deleted;
  }

  private getTtlJitterSeconds(): number {
    return Math.floor(Math.random() * CACHE_TTL_JITTER_MAX_SECONDS);
  }
}
