import { GUARDS_METADATA } from '@nestjs/common/constants';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PERMISSIONS_KEY } from 'src/features/auth/decorators/permissions.decorator';
import { RolesGuard } from 'src/features/auth/guards/roles.guard';
import { AuthGuard } from 'src/features/auth/public-api';
import { AdminRestaurantsController } from 'src/features/restaurants/controllers/admin-restaurants.controller';
import { MerchantRestaurantsController } from 'src/features/restaurants/controllers/merchant-restaurants.controller';
import { Permission } from 'src/shared/types/enums/permission.enum';

describe('Restaurant merchant authorization policy', () => {
  it('requires authentication for the complete merchant profile controller', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, MerchantRestaurantsController) as unknown[];
    expect(guards).toContain(AuthGuard);
  });

  it('does not expose ownerId or status in the merchant request DTO', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/features/restaurants/dto/restaurant-request.dto.ts'),
      'utf8',
    );

    expect(source).toContain("'ownerId'");
    expect(source).toContain("'status'");
  });
});

describe('Restaurant approval authorization policy', () => {
  it.each(['approveRestaurant', 'rejectRestaurant'])(
    'requires the restaurant write capability for %s',
    (methodName) => {
      const method = Object.getOwnPropertyDescriptor(
        AdminRestaurantsController.prototype,
        methodName,
      )?.value as object;
      const guards = Reflect.getMetadata(GUARDS_METADATA, AdminRestaurantsController) as unknown[];
      const permissions = Reflect.getMetadata(PERMISSIONS_KEY, method) as string[];

      expect(guards).toContain(RolesGuard);
      expect(permissions).toEqual([Permission.STORE.WRITE]);
    },
  );
});
