export const CACHE_PORT = Symbol('CACHE_PORT');

export interface CachePort {
  remember<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T>;
  deleteByPattern(pattern: string): Promise<number>;
}
