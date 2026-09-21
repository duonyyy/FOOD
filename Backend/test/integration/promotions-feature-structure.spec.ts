import { readdirSync, readFileSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';

const featureRoot = resolve(process.cwd(), 'src/features/promotions');

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

describe('Promotions feature structure', () => {
  const files = listFiles(featureRoot);

  it('has one main module and one public API', () => {
    const modules = files
      .filter((file) => file.endsWith('.module.ts'))
      .map((file) => relative(featureRoot, file));
    const publicApis = files
      .filter((file) => file.endsWith('public-api.ts'))
      .map((file) => relative(featureRoot, file));

    expect(modules).toEqual(['promotions.module.ts']);
    expect(publicApis).toEqual(['public-api.ts']);
  });

  it('keeps its public API narrow', () => {
    const publicApi = readFileSync(resolve(featureRoot, 'public-api.ts'), 'utf8');

    expect(publicApi).toContain('PromotionsModule');
    expect(publicApi).toContain('PublicPromotionsService');
    expect(publicApi).toContain('PromotionUsageService');
    expect(publicApi).not.toMatch(/Controller|AdminPromotionsService|entities|Repository/);
  });

  it('uses role controllers and services without legacy promotion files', () => {
    const relativeFiles = files
      .filter((file) => extname(file) === '.ts')
      .map((file) => relative(featureRoot, file).replaceAll('\\', '/'));
    const moduleSource = readFileSync(resolve(featureRoot, 'promotions.module.ts'), 'utf8');

    expect(relativeFiles).toContain('controllers/public-promotions.controller.ts');
    expect(relativeFiles).toContain('controllers/admin-promotions.controller.ts');
    expect(relativeFiles).toContain('services/public-promotions.service.ts');
    expect(relativeFiles).toContain('services/admin-promotions.service.ts');
    expect(relativeFiles).toContain('services/promotion-usage.service.ts');
    expect(relativeFiles).toContain('contracts/promotion-rules.policy.ts');
    expect(relativeFiles).not.toContain('contracts/promotion-eligibility.policy.ts');
    expect(relativeFiles).not.toContain('services/promotion-redemption.service.ts');
    expect(relativeFiles).not.toContain('controllers/promotion.controller.ts');
    expect(relativeFiles).not.toContain('services/promotion.service.ts');
    expect(moduleSource).not.toContain('forwardRef');
  });
});
