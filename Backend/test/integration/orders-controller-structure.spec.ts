import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ordersRoot = resolve(process.cwd(), 'src/features/orders');

function source(relativePath: string): string {
  return readFileSync(resolve(ordersRoot, relativePath), 'utf8');
}

describe('Orders controller structure', () => {
  it('registers controllers with simple actor-based names', () => {
    const moduleSource = source('orders.module.ts');

    expect(moduleSource).toContain('PublicOrdersController');
    expect(moduleSource).toContain('CustomerOrdersController');
    expect(moduleSource).toContain('MerchantOrdersController');
    expect(moduleSource).toContain('AdminOrdersController');
    expect(existsSync(resolve(ordersRoot, 'controllers/order.controller.ts'))).toBe(false);
  });

  it('keeps the existing HTTP routes in the matching controller', () => {
    const publicController = source('controllers/public-orders.controller.ts');
    const customerController = source('controllers/customer-orders.controller.ts');
    const merchantController = source('controllers/merchant-orders.controller.ts');
    const adminController = source('controllers/admin-orders.controller.ts');

    for (const controller of [
      publicController,
      customerController,
      merchantController,
      adminController,
    ]) {
      expect(controller).toContain("@Controller('orders')");
    }

    expect(publicController).toContain("@Post('calculate')");
    expect(publicController).toContain("@Post('calculate-custom')");
    expect(publicController).toContain("@Post('validate-promotion')");

    expect(customerController).toContain('@Post()');
    expect(customerController).toContain("@Get('my')");
    expect(customerController).toContain("@Get(':id')");
    expect(customerController).toContain("@Get('user/:userId')");
    expect(customerController).toContain("@Get(':id/details')");
    expect(customerController).toContain("@Delete(':id')");
    expect(customerController).toContain("@Post(':id/payment')");

    expect(merchantController).toContain("@Get('restaurant/my')");
    expect(merchantController).toContain("@Put(':id/status')");

    expect(adminController).toContain('@Get()');
    expect(adminController).toContain("@Put('admin/:id/status')");
  });

  it('does not introduce forwardRef', () => {
    const combinedSource = [
      source('orders.module.ts'),
      source('controllers/public-orders.controller.ts'),
      source('controllers/customer-orders.controller.ts'),
      source('controllers/merchant-orders.controller.ts'),
      source('controllers/admin-orders.controller.ts'),
    ].join('\n');

    expect(combinedSource).not.toContain('forwardRef');
  });
});
