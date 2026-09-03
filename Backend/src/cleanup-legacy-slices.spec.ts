import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const retiredLegacySlices = [
  'src/modules/address',
  'src/modules/analytics',
  'src/modules/catalog',
  'src/modules/category',
  'src/modules/checkout',
  'src/modules/communication',
  'src/modules/delivery',
  'src/modules/identity',
  'src/modules/review',
  'src/modules/sales',
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('legacy slice cleanup', () => {
  it('removes only retired slices and leaves no source caller behind', () => {
    const sources = sourceFiles(resolve(process.cwd(), 'src'))
      .filter((file) => !file.endsWith('.spec.ts'))
      .map((file) => readFileSync(file, 'utf8'));

    for (const slice of retiredLegacySlices) {
      expect(existsSync(resolve(process.cwd(), slice))).toBe(false);
      const importFragment = slice.replace(/^src\//, '');
      expect(sources.some((source) => source.includes(importFragment))).toBe(false);
    }
  });

  it('keeps the legacy OrderModule import graph free of duplicate UsersModule entries', () => {
    const orderModule = readFileSync(
      resolve(process.cwd(), 'src/modules/order/order.module.ts'),
      'utf8',
    );
    expect(orderModule.match(/\bUsersModule\b/g)).toHaveLength(2); // import + one module import
  });

  it('has no runtime forwardRef call after contracts/events replaced cycles', () => {
    const sources = sourceFiles(resolve(process.cwd(), 'src'))
      .filter((file) => !file.endsWith('.spec.ts'))
      .map((file) => readFileSync(file, 'utf8'));
    expect(sources.some((source) => /\bforwardRef\s*\(/.test(source))).toBe(false);
  });
});
