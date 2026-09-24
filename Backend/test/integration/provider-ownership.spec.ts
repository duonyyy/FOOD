import { MODULE_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from 'src/features/auth/auth.module';
import { AuthGuard, RolesGuard, WebSocketAuthGuard } from 'src/features/auth/public-api';
import { OrderCreationService } from 'src/features/orders/public-api';
import { PaymentModule } from 'src/features/payments/payment.module';
import { SystemConstraintsModule } from 'src/features/system-constraints/public-api';
import { SystemConstraintsService } from 'src/features/system-constraints/services/system-constraints.service';
import { UsersModule } from 'src/features/users/identity-auth.public-api';
import { IdentityUserProfileModule } from 'src/features/users/identity-user-profile.public-api';
import { IdentityModule, IdentityUserQueryService } from 'src/features/users/public-api';
import { IdentityRoleQueryService } from 'src/features/users/roles/services/identity-role-query.service';
import { RolesService } from 'src/features/users/roles/services/role.service';
import { IdentityUserProfileService } from 'src/features/users/users/services/identity-user-profile.service';
import { UsersService } from 'src/features/users/users/services/users.service';

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

  it('keeps guard and identity query providers in their owning modules', () => {
    expect(getModuleProviders(AuthModule)).toEqual(expect.arrayContaining([AuthGuard, RolesGuard]));
    expect(getModuleProviders(IdentityModule)).toEqual(
      expect.arrayContaining([IdentityUserQueryService, IdentityRoleQueryService]),
    );
    expect(getModuleProviders(IdentityModule)).not.toContain(AuthGuard);
    expect(getModuleExports(IdentityModule)).toEqual([IdentityUserQueryService]);
    expect(getModuleProviders(IdentityUserProfileModule)).toContain(IdentityUserProfileService);
    expect(getModuleProviders(IdentityModule)).not.toContain(IdentityUserProfileService);
    expect(getModuleProviders(UsersModule)).toEqual([UsersService, RolesService]);
    expect(getModuleExports(UsersModule)).toEqual([UsersService, RolesService]);
    expect(getModuleProviders(IdentityModule)).not.toContain(RolesService);
  });

  it('registers SystemConstraintsService once in its owner module', () => {
    expect(getModuleProviders(SystemConstraintsModule)).toContain(SystemConstraintsService);
    expect(getModuleProviders(PaymentModule)).not.toContain(SystemConstraintsService);
  });

  it('does not re-provide the Orders creation service in Payments', () => {
    expect(getModuleProviders(PaymentModule)).not.toContain(OrderCreationService);
  });
});

function getModuleProviders(moduleType: object): unknown[] {
  return Reflect.getMetadata(MODULE_METADATA.PROVIDERS, moduleType) as unknown[];
}

function getModuleExports(moduleType: object): unknown[] {
  return Reflect.getMetadata(MODULE_METADATA.EXPORTS, moduleType) as unknown[];
}
