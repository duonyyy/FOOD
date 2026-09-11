type PromotionCacheKeyPart =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | PromotionCacheKeyPart[]
  | { [key: string]: PromotionCacheKeyPart };

function normalizeCacheKeyPart(value: PromotionCacheKeyPart): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeCacheKeyPart);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = normalizeCacheKeyPart(value[key]);
        return result;
      }, {});
  }
  return value;
}

/** Promotion-owned cache namespaces and expiry policy. */
export function buildPromotionCacheKey(
  namespace: string,
  parts: Record<string, PromotionCacheKeyPart> = {},
): string {
  return `${namespace}:${Buffer.from(JSON.stringify(normalizeCacheKeyPart(parts))).toString('base64url')}`;
}

export const PROMOTION_CACHE_TTL_SECONDS = {
  MEDIUM: 60,
  LONG: 300,
} as const;
