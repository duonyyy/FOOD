import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

describe('payment cross-feature boundary', () => {
  it('keeps payment source free from direct Ordering, Catalog and Promotions dependencies', () => {
    const sourceFiles = collectTypeScriptFiles(resolve(__dirname)).filter(
      (file) => !file.endsWith('.spec.ts'),
    );
    const forbiddenImport =
      /(?:from|import\s*\()\s*['"][^'"]*(?:entities\/(?:order|food|promotion)\.entity|modules\/(?:order|food|promotion)|features\/(?:orders|menu|promotions))[^'"]*['"]/i;
    const forbiddenMutation =
      /\b(?:orderRepository|foodRepository|promotionRepository|updateOrderStatus|usePromotion|incrementSales|FoodService|OrderService|PromotionService)\b/;

    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(forbiddenImport);
      expect(source).not.toMatch(forbiddenMutation);
    }
  });

  it('keeps payment persistence limited to Checkout', () => {
    const moduleSource = readFileSync(resolve(__dirname, 'payment.module.ts'), 'utf8');

    expect(moduleSource).toContain('TypeOrmModule.forFeature([Checkout])');
    expect(moduleSource).not.toMatch(/forFeature\([\s\S]*(Order|Food|Promotion|User)/);
  });
});

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collectTypeScriptFiles(path) : path.endsWith('.ts') ? [path] : [];
  });
}
