import { MODULE_METADATA } from '@nestjs/common/constants';
import { AppModule } from 'src/app.module';
import { AnalyticsModule } from 'src/features/analytics/public-api';
import { CommunicationsModule } from 'src/features/communications/public-api';
import { DeliveryModule } from 'src/features/delivery/public-api';
import { FeaturesModule } from 'src/features/features.module';
import { LocationsModule } from 'src/features/locations/public-api';
import { MenuModule } from 'src/features/menu/public-api';
import { NotificationsModule } from 'src/features/notifications/public-api';
import { OrdersModule } from 'src/features/orders/public-api';
import { PaymentModule } from 'src/features/payments/public-api';
import { PromotionsModule } from 'src/features/promotions/public-api';
import { RestaurantsModule } from 'src/features/restaurants/public-api';
import { ReviewsModule } from 'src/features/reviews/public-api';
import { SystemConstraintsModule } from 'src/features/system-constraints/public-api';
import { IdentityModule } from 'src/features/users/public-api';
import { InfraCoreModule } from 'src/infra/core/infra-core.module';

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
      AnalyticsModule,
      IdentityModule,
      LocationsModule,
      RestaurantsModule,
      MenuModule,
      PromotionsModule,
      OrdersModule,
      PaymentModule,
      DeliveryModule,
      ReviewsModule,
      CommunicationsModule,
      NotificationsModule,
      SystemConstraintsModule,
    ]);
  });
});

function getModuleImports(moduleType: object): unknown[] {
  return Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleType) as unknown[];
}
