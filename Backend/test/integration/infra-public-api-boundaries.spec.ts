import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const infraPublicApi = /^src\/infra\/[^/]+\/(?:[a-z-]+\.)?public-api$/;

function featureSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return featureSourceFiles(path);
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('infrastructure public API boundaries', () => {
  it('keeps feature imports on narrow infrastructure public entrypoints', () => {
    const violations = featureSourceFiles(resolve(process.cwd(), 'src/features')).flatMap(
      (file) => {
        const source = readFileSync(file, 'utf8');
        return [...source.matchAll(/from ['"]([^'"]*(?:src\/infra|\.\.\/.*infra)[^'"]*)['"]/g)]
          .map((match) => match[1])
          .filter((importPath) => !infraPublicApi.test(importPath))
          .map((importPath) => `${file}: ${importPath}`);
      },
    );

    expect(violations).toEqual([]);
  });
});
