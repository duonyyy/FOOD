import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('dashboard read-model boundary', () => {
  it('does not register or inject repositories owned by source features', () => {
    const moduleSource = readFileSync(
      resolve(process.cwd(), 'src/features/analytics/analytics.module.ts'),
      'utf8',
    );
    const serviceSource = readFileSync(
      resolve(process.cwd(), 'src/features/analytics/services/dashboard.service.ts'),
      'utf8',
    );

    expect(moduleSource).toContain('TypeOrmModule.forFeature([AnalyticsOrderMetric])');
    expect(moduleSource).not.toMatch(
      /forFeature\([\s\S]*(Order,|User,|ShippingDetail|Food|Promotion)/,
    );
    expect(serviceSource).toContain('AnalyticsDashboardQueryService');
    expect(serviceSource).not.toMatch(
      /InjectRepository|orderRepository|userRepository|shippingDetailRepository/,
    );
  });
});
