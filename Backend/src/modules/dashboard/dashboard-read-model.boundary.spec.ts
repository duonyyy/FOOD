import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('dashboard read-model boundary', () => {
  it('does not register or inject repositories owned by source features', () => {
    const moduleSource = readFileSync(resolve(process.cwd(), 'src/modules/dashboard/dashboard.module.ts'), 'utf8');
    const serviceSource = readFileSync(resolve(process.cwd(), 'src/modules/dashboard/dashboard.service.ts'), 'utf8');

    expect(moduleSource).toContain('AnalyticsModule');
    expect(moduleSource).not.toMatch(/TypeOrmModule\.forFeature|OrderModule/);
    expect(serviceSource).toContain('AnalyticsDashboardQueryService');
    expect(serviceSource).not.toMatch(/InjectRepository|orderRepository|userRepository|shippingDetailRepository/);
  });
});
