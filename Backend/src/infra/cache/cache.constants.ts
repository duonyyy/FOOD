export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export const CACHE_TTL_SECONDS = {
  SHORT: 30,
  MEDIUM: 60,
  LONG: 300,
  VERY_LONG: 1800,
} as const;

export const CACHE_TTL_JITTER_MAX_SECONDS = 30;
