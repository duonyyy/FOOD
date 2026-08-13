import { ESLint } from 'eslint';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import architectureBoundaryPlugin = require('../tools/eslint-rules/architecture-boundaries.cjs');

const architectureRulePrefix = 'foodee-boundaries/';
const testArchitectureBoundaryPlugin = architectureBoundaryPlugin as never;
const architectureEslint = new ESLint({
  cwd: process.cwd(),
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.ts'],
      languageOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
      },
      plugins: { 'foodee-boundaries': testArchitectureBoundaryPlugin },
      rules: {
        'foodee-boundaries/feature-import-boundaries': 'error',
        'foodee-boundaries/no-foreign-legacy-entity-import': 'error',
        'foodee-boundaries/no-forward-ref': 'error',
        'foodee-boundaries/no-duplicate-module-providers': 'error',
      },
    },
  ],
});

async function architectureRuleIds(source: string, filePath: string): Promise<string[]> {
  const [result] = await architectureEslint.lintText(source, { filePath });

  return result.messages
    .map((message) => message.ruleId)
    .filter((ruleId): ruleId is string => ruleId?.startsWith(architectureRulePrefix) ?? false);
}

describe('architecture boundary lint rules', () => {
  it('rejects a new forwardRef call', async () => {
    await expect(
      architectureRuleIds('forwardRef(() => Dependency);', 'src/app.module.ts'),
    ).resolves.toContain('foodee-boundaries/no-forward-ref');
  });

  it('rejects a feature deep import and direct infra import', async () => {
    const source = [
      "import { OrderService } from 'src/features/ordering/services/order.service';",
      "import { QueueService } from 'src/infra/queue/queue.service';",
    ].join('\n');

    await expect(architectureRuleIds(source, 'src/features/features.module.ts')).resolves.toEqual([
      'foodee-boundaries/feature-import-boundaries',
      'foodee-boundaries/feature-import-boundaries',
    ]);
  });

  it('allows the narrow Merchant Catalog public entrypoint without loading RestaurantsModule', async () => {
    await expect(
      architectureRuleIds(
        "import { MerchantCatalogModule } from 'src/features/restaurants/merchant-catalog.public-api';",
        'src/features/menu/foods/food.module.ts',
      ),
    ).resolves.toEqual([]);
  });

  it('keeps Catalog consumers off the broad Restaurants public barrel', () => {
    const catalogConsumers = [
      'src/features/menu/foods/food.module.ts',
      'src/features/menu/foods/food-query.service.ts',
      'src/features/menu/services/food-command.service.ts',
      'src/features/menu/toppings/topping.module.ts',
      'src/features/menu/toppings/topping-command.service.ts',
    ];

    for (const file of catalogConsumers) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source).not.toContain('restaurants/public-api');
      expect(source).toContain('restaurants/merchant-catalog.public-api');
    }
  });

  it('rejects a feature repository entity import owned by another feature', async () => {
    const source = ["import { Food } from 'src/entities/food.entity';", 'void Food;'].join('\n');

    await expect(
      architectureRuleIds(source, 'src/features/orders/services/create-order.service.ts'),
    ).resolves.toContain('foodee-boundaries/no-foreign-legacy-entity-import');
  });

  it('rejects a duplicate module provider', async () => {
    const source = 'Module({ providers: [ExampleService, ExampleService] });';

    await expect(architectureRuleIds(source, 'src/app.module.ts')).resolves.toContain(
      'foodee-boundaries/no-duplicate-module-providers',
    );
  });
});
