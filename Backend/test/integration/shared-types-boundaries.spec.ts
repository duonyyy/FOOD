import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const sharedTypesRoot = resolve(process.cwd(), 'src/shared/types');

function typescriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? typescriptFiles(path) : entry.name.endsWith('.ts') ? [path] : [];
  });
}

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('shared type ownership boundaries', () => {
  it('contains only explicitly approved shared contracts', () => {
    const approvedExports = new Map([
      ['enums/auth-provider.enum.ts', ['AuthProvider']],
      ['enums/order-status.enum.ts', ['OrderStatus']],
      ['enums/permission.enum.ts', ['Permission', 'PermissionType']],
      [
        'delivery/delivery-assignment.types.ts',
        ['DeliveryAssignmentJobData', 'PendingAssignmentState', 'ShipperAssignmentHold'],
      ],
    ]);
    const actualFiles = typescriptFiles(sharedTypesRoot)
      .map((path) => relative(sharedTypesRoot, path).replaceAll('\\', '/'))
      .sort();

    expect(actualFiles).toEqual([...approvedExports.keys()].sort());
    for (const [path, approvedNames] of approvedExports) {
      const exportedNames = [
        ...source(resolve(sharedTypesRoot, path)).matchAll(
          /export\s+(?:enum|interface|type|const|class)\s+(\w+)/g,
        ),
      ].map((match) => match[1]);

      expect(exportedNames).toEqual(approvedNames);
    }
  });

  it('keeps shared contracts independent from features, entities, frameworks, and DI', () => {
    for (const path of typescriptFiles(sharedTypesRoot)) {
      const sharedSource = source(path);

      expect(sharedSource).not.toMatch(
        /from\s+['"](?:src\/(?:features|entities|infra)\/|@nestjs\/|typeorm(?:\/|['"]))/,
      );
      expect(sharedSource).not.toMatch(/\b(?:Inject|Injectable|Module|forwardRef)\s*\(/);
    }
  });

  it('removes the local OrderStatus declaration while preserving the Orders public contract', () => {
    const orderCore = source(
      resolve(process.cwd(), 'src/features/orders/services/order-core.service.ts'),
    );
    const ordersPublicApi = source(resolve(process.cwd(), 'src/features/orders/public-api.ts'));
    const sourceAndTests = [resolve(process.cwd(), 'src'), resolve(process.cwd(), 'test')]
      .flatMap(typescriptFiles)
      .map(source);

    expect(orderCore).not.toMatch(/export enum OrderStatus/);
    expect(ordersPublicApi).toContain(
      "export { OrderStatus } from 'src/shared/types/enums/order-status.enum';",
    );

    for (const fileSource of sourceAndTests) {
      expect(fileSource).not.toMatch(
        /import\s*\{[^}]*\bOrderStatus\b[^}]*\}\s*from\s*['"][^'"]*order-core\.service['"]/s,
      );
      expect(fileSource).not.toMatch(
        /from\s+['"][^'"]*features\/auth\/enums\/auth-provider\.enum['"]/,
      );
      expect(fileSource).not.toMatch(/from\s+['"]src\/constants\/permission\.enum['"]/);
    }
  });
});
