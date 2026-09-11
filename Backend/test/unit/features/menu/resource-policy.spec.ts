import { GUARDS_METADATA } from '@nestjs/common/constants';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Permission } from 'src/constants/permission.enum';
import { PERMISSIONS_KEY } from 'src/features/auth/decorators/permissions.decorator';
import { CategoryController } from 'src/features/menu/categories/category.controller';
import { AdminFoodController } from 'src/features/menu/foods/controllers/admin-food.controller';
import { MerchantFoodController } from 'src/features/menu/foods/controllers/merchant-food.controller';
import { AuthGuard, RolesGuard } from 'src/features/users/public-api';

describe('Catalog resource policies', () => {
  it('requires merchant authentication for Food writes and admin capability for admin delete', () => {
    for (const methodName of ['create', 'update', 'remove', 'updateStatus', 'addTopping']) {
      const method = Object.getOwnPropertyDescriptor(MerchantFoodController.prototype, methodName)
        ?.value as unknown as object;
      const guards = Reflect.getMetadata(GUARDS_METADATA, method) as unknown[] | undefined;
      expect(guards).toContain(AuthGuard);
    }

    const adminDelete = Object.getOwnPropertyDescriptor(AdminFoodController.prototype, 'deleteFood')
      ?.value as unknown as object;
    const adminGuards = Reflect.getMetadata(GUARDS_METADATA, adminDelete) as unknown[] | undefined;
    expect(adminGuards).toContain(RolesGuard);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, adminDelete) as unknown).toEqual([
      Permission.FOOD.DELETE,
    ]);
  });

  it('protects Catalog category writes and keeps reads public', () => {
    const readMethod = Object.getOwnPropertyDescriptor(CategoryController.prototype, 'findAll')
      ?.value as unknown as object;
    expect(Reflect.getMetadata(GUARDS_METADATA, readMethod) as unknown).toBeUndefined();
    const writeMethod = Object.getOwnPropertyDescriptor(CategoryController.prototype, 'create')
      ?.value as unknown as object;
    const writeGuards = Reflect.getMetadata(GUARDS_METADATA, writeMethod) as unknown[] | undefined;
    expect(writeGuards).toContain(RolesGuard);
  });

  it('does not expose TypeORM entities from the snapshot contract', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/features/menu/contracts/menu-reader.port.ts'),
      'utf8',
    );
    expect(source).not.toContain("from 'src/entities/food.entity'");
    expect(source).not.toContain("from 'src/entities/topping.entity'");
  });
});
