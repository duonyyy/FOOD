import { MODULE_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { SystemConstraintsModule } from './features/system-constraints/public-api';
import { OrderService } from './modules/order/order.service';
import { RolesService } from './modules/role/role.service';
import { UsersService } from './modules/users/users.service';
import { PaymentModule } from './payment/payment.module';
import { SystemConstraintsService } from './services/system-constraints.service';

describe('provider ownership', () => {
  it('uses users and roles from their owner modules instead of re-providing them in auth', () => {
    const providers = getModuleProviders(AuthModule);

    expect(providers).not.toContain(UsersService);
    expect(providers).not.toContain(RolesService);
    expect(providers).not.toContain(ConfigService);
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
