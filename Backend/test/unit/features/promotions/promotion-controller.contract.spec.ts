import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_KEY } from 'src/features/auth/decorators/permissions.decorator';
import { RolesGuard } from 'src/features/auth/guards/roles.guard';
import { AdminPromotionsController } from 'src/features/promotions/controllers/admin-promotions.controller';
import { PublicPromotionsController } from 'src/features/promotions/controllers/public-promotions.controller';
import { Permission } from 'src/shared/types/enums/permission.enum';

describe('Promotions controller contract', () => {
  it('preserves the public active-promotions route without an auth guard', () => {
    const method = PublicPromotionsController.prototype.getPublicActivePromotions;

    expect(Reflect.getMetadata(PATH_METADATA, PublicPromotionsController)).toBe('promotions');
    expect(Reflect.getMetadata(PATH_METADATA, method)).toBe('all');
    expect(Reflect.getMetadata(METHOD_METADATA, method)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(GUARDS_METADATA, PublicPromotionsController)).toBeUndefined();
  });

  it('keeps admin routes behind RolesGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminPromotionsController) as unknown[];

    expect(Reflect.getMetadata(PATH_METADATA, AdminPromotionsController)).toBe('promotions');
    expect(guards).toContain(RolesGuard);
  });

  it('uses read permission for GET /promotions/:id', () => {
    const method = AdminPromotionsController.prototype.getPromotionById;

    expect(Reflect.getMetadata(PATH_METADATA, method)).toBe(':id');
    expect(Reflect.getMetadata(METHOD_METADATA, method)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, method)).toEqual([Permission.PROMOTION.READ]);
  });
});
