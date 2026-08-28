type CacheKeyPart =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | CacheKeyPart[]
  | { [key: string]: CacheKeyPart };

const normalizeValue = (value: CacheKeyPart): unknown => {
  if (value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeValue(value[key]);
        return acc;
      }, {});
  }

  return value;
};

export const buildCacheKey = (
  namespace: string,
  parts: Record<string, CacheKeyPart> = {},
): string => {
  const normalized = normalizeValue(parts);
  return `${namespace}:${Buffer.from(JSON.stringify(normalized)).toString('base64url')}`;
};
