import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(path);
    }

    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });
}

function relative(path: string): string {
  return path.slice(root.length + 1).replaceAll('\\', '/');
}

describe('retained infrastructure and worker boundaries', () => {
  const sourceRoot = resolve(root, 'src');
  const allowedSymbolTokens = new Map([
    [
      'src/features/delivery/contracts/delivery-assignment-queue.port.ts:DELIVERY_ASSIGNMENT_QUEUE_PORT',
      'BullMQ queue boundary',
    ],
    [
      'src/features/delivery/contracts/pending-assignment-store.port.ts:PENDING_ASSIGNMENT_STORE',
      'Redis-backed dispatch state boundary',
    ],
    [
      'src/features/system-constraints/contracts/storage.port.ts:STORAGE_PORT',
      'object storage boundary',
    ],
    ['src/infra/cache/cache.constants.ts:REDIS_CLIENT', 'external Redis client'],
    ['src/infra/contracts/cache.port.ts:CACHE_PORT', 'cache adapter boundary'],
    ['src/infra/contracts/geocoding.port.ts:GEOCODING_PORT', 'geocoding adapter boundary'],
    ['src/infra/contracts/route.port.ts:ROUTE_PORT', 'routing adapter boundary'],
  ]);

  it('allows only documented Symbol tokens', () => {
    const actual = sourceFiles(sourceRoot)
      .flatMap((path) => {
        const source = readFileSync(path, 'utf8');
        return [...source.matchAll(/export const ([A-Z0-9_]+) = Symbol\(/g)].map(
          ([, token]) => `${relative(path)}:${token}`,
        );
      })
      .sort();

    expect(actual).toEqual([...allowedSymbolTokens.keys()].sort());
    expect([...allowedSymbolTokens.values()]).not.toContain('');
  });

  it('keeps non-Symbol boundaries only where the runtime requires them', () => {
    const paymentContract = readFileSync(
      resolve(root, 'src/features/payments/contracts/payment-gateway.port.ts'),
      'utf8',
    );
    const minioService = readFileSync(resolve(root, 'src/infra/minio/minio.service.ts'), 'utf8');

    expect(paymentContract).toContain('interface PaymentGatewayPort');
    expect(paymentContract).toContain("'momo' | 'vnpay'");
    expect(minioService).toContain('@Inject(MINIO_CONNECTION)');
  });

  it('allows useExisting only for documented adapter or role aliases', () => {
    const actual = sourceFiles(sourceRoot)
      .flatMap((path) => {
        const source = readFileSync(path, 'utf8');
        return [...source.matchAll(/useExisting:/g)].map(() => relative(path));
      })
      .sort();

    expect(actual).toEqual(
      [
        'src/features/delivery/delivery.module.ts',
        'src/features/delivery/delivery.module.ts',
        'src/features/delivery/delivery.module.ts',
        'src/features/delivery/delivery.module.ts',
        'src/features/delivery/delivery.module.ts',
        'src/infra/cache/cache.module.ts',
        'src/infra/mapbox/geocoding-adapter.module.ts',
        'src/infra/mapbox/route-adapter.module.ts',
      ].sort(),
    );
  });
});
