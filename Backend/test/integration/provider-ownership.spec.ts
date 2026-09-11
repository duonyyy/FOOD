import { MODULE_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from 'src/features/auth/auth.module';
import { WebSocketAuthGuard } from 'src/features/auth/public-api';
import { OrderService } from 'src/features/orders/services/order.service';
import { PaymentModule } from 'src/features/payments/payment.module';
import { SystemConstraintsModule } from 'src/features/system-constraints/public-api';
import { SystemConstraintsService } from 'src/features/system-constraints/services/system-constraints.service';
import { RolesService } from 'src/features/users/roles/role.service';
import { UsersService } from 'src/features/users/services/users.service';

describe('provider ownership', () => {
  it('uses users and roles from their owner modules instead of re-providing them in auth', () => {
    const providers = getModuleProviders(AuthModule);

    expect(providers).not.toContain(UsersService);
    expect(providers).not.toContain(RolesService);
    expect(providers).not.toContain(ConfigService);
  });

  it('provides and exports WebSocketAuthGuard for authenticated subscriptions', () => {
    expect(getModuleProviders(AuthModule)).toContain(WebSocketAuthGuard);
    expect(getModuleExports(AuthModule)).toContain(WebSocketAuthGuard);
  });

  it('registers SystemConstraintsService once in its owner module', () => {
    expect(getModuleProviders(SystemConstraintsModule)).toContain(SystemConstraintsService);
    expect(getModuleProviders(PaymentModule)).not.toContain(SystemConstraintsService);
  });

  it('does not re-provide OrderService in payment after the payment event boundary', () => {
    expect(getModuleProviders(PaymentModule)).not.toContain(OrderService);
  });
});

function getModuleProviders(moduleType: object): unknown[] {
  return Reflect.getMetadata(MODULE_METADATA.PROVIDERS, moduleType) as unknown[];
}

function getModuleExports(moduleType: object): unknown[] {
  return Reflect.getMetadata(MODULE_METADATA.EXPORTS, moduleType) as unknown[];
}
