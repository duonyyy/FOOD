import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PaymentModule } from 'src/features/payments/payment.module';

describe('payment ownership boundary', () => {
  it('registers only the checkout persistence entity', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/features/payments/payment.module.ts'),
      'utf8',
    );

    expect(source).toContain('TypeOrmModule.forFeature([Checkout])');
    expect(source).not.toMatch(/forFeature\([\s\S]*(Order|Food|User|Promotion)/);
  });

  it('does not import Ordering, Catalog, Identity or Promotions persistence into Payments', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/features/payments/payment.service.ts'),
      'utf8',
    );

    expect(PaymentModule).toBeDefined();
    expect(source).not.toMatch(/entities\/(order|food|user|promotion)\.entity/);
    expect(source).not.toContain('orderRepository');
    expect(source).not.toContain('foodRepository');
  });
});
