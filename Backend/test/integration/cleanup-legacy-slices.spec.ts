import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const legacyModulesRoot = 'src/modules';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('legacy slice cleanup', () => {
  it('keeps business runtime code outside the retired modules root', () => {
    const sources = sourceFiles(resolve(process.cwd(), 'src'))
      .filter((file) => !file.endsWith('.spec.ts'))
      .map((file) => readFileSync(file, 'utf8'));

    const modulesPath = resolve(process.cwd(), legacyModulesRoot);
    if (existsSync(modulesPath)) {
      expect(readdirSync(modulesPath)).toEqual([]);
    }

    expect(sources.some((source) => source.includes('modules/'))).toBe(false);
  });

  it('keeps the Orders runtime import graph free of duplicate UsersModule entries', () => {
    const orderModule = readFileSync(
      resolve(process.cwd(), 'src/features/orders/orders.module.ts'),
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
