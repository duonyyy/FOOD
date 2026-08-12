import { GUARDS_METADATA } from '@nestjs/common/constants';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PERMISSIONS_KEY } from 'src/auth/decorators/permissions.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Permission } from 'src/constants/permission.enum';
import { AuthGuard } from 'src/features/identity/public-api';
import { RestaurantAdminController } from './controllers/admin-restaurants.controller';
import { RestaurantMerchantController } from './controllers/merchant-profile.controller';

describe('Restaurant merchant authorization policy', () => {
  it('requires authentication for the complete merchant profile controller', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, RestaurantMerchantController) as unknown[];
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
        RestaurantAdminController.prototype,
        methodName,
      )?.value as object;
      const guards = Reflect.getMetadata(GUARDS_METADATA, RestaurantAdminController) as unknown[];
      const permissions = Reflect.getMetadata(PERMISSIONS_KEY, method) as string[];

      expect(guards).toContain(RolesGuard);
      expect(permissions).toEqual([Permission.STORE.WRITE]);
    },
  );
});
