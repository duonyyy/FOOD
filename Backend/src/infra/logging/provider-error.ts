export type ExternalProvider = 'minio' | 'mapbox' | 'momo' | 'vnpay' | 'queue';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function toSafeCode(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'string' && /^[A-Za-z0-9._:-]{1,64}$/.test(value)) {
    return value;
  }

  return undefined;
}

export function getProviderErrorCode(error: unknown): string {
  if (!isRecord(error)) {
    return 'UNKNOWN';
  }

  const response = isRecord(error.response) ? error.response : undefined;
  const responseData = response && isRecord(response.data) ? response.data : undefined;
  const candidates = [
    error.code,
    error.statusCode,
    responseData?.code,
    responseData?.resultCode,
    response?.status,
  ];

  for (const candidate of candidates) {
    const code = toSafeCode(candidate);
    if (code) {
      return code;
    }
  }

  return 'UNKNOWN';
}

export function getProviderErrorType(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}
