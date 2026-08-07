import { MODULE_METADATA } from '@nestjs/common/constants';
import { AppModule } from './app.module';
import { CommunicationsModule } from './features/communications/public-api';
import { DashboardModule } from './features/dashboard/public-api';
import { DeliveryModule } from './features/delivery/public-api';
import { FeaturesModule } from './features/features.module';
import { IdentityModule } from './features/identity/public-api';
import { LocationsModule } from './features/locations/public-api';
import { MenuModule } from './features/menu/public-api';
import { OrdersModule } from './features/orders/public-api';
import { PaymentsModule } from './features/payments/public-api';
import { PromotionsModule } from './features/promotions/public-api';
import { RestaurantsModule } from './features/restaurants/public-api';
import { ReviewsModule } from './features/reviews/public-api';
import { SystemConstraintsModule } from './features/system-constraints/public-api';
import { InfraCoreModule } from './infra/core/infra-core.module';

describe('AppModule composition', () => {
  it('composes only the infrastructure core and feature root modules', () => {
    const imports = getModuleImports(AppModule);

    expect(imports).toEqual([InfraCoreModule, FeaturesModule]);
  });

  it('does not duplicate direct imports in the root composition modules', () => {
    for (const moduleType of [AppModule, InfraCoreModule, FeaturesModule]) {
      const imports = getModuleImports(moduleType);

      expect(new Set(imports).size).toBe(imports.length);
    }
  });

  it('composes every canonical non-empty feature shell through its public API', () => {
    expect(getModuleImports(FeaturesModule)).toEqual([
      IdentityModule,
      LocationsModule,
      RestaurantsModule,
      MenuModule,
      PromotionsModule,
      OrdersModule,
      PaymentsModule,
      DeliveryModule,
      ReviewsModule,
      CommunicationsModule,
      DashboardModule,
      SystemConstraintsModule,
    ]);
  });
});

function getModuleImports(moduleType: object): unknown[] {
  return Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleType) as unknown[];
}
