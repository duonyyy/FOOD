import { GUARDS_METADATA } from '@nestjs/common/constants';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PERMISSIONS_KEY } from 'src/auth/decorators/permissions.decorator';
import { Permission } from 'src/constants/permission.enum';
import { AuthGuard, RolesGuard } from 'src/features/identity/public-api';
import { FoodController } from 'src/modules/food/food.controller';
import { CategoryController } from './categories/category.controller';

describe('Catalog resource policies', () => {
  it('requires merchant authentication for Food writes and admin capability for admin delete', () => {
    for (const methodName of ['create', 'update', 'remove', 'updateStatus', 'addTopping']) {
      const method = Object.getOwnPropertyDescriptor(FoodController.prototype, methodName)?.value;
      expect(Reflect.getMetadata(GUARDS_METADATA, method)).toContain(AuthGuard);
    }

    const adminDelete = Object.getOwnPropertyDescriptor(
      FoodController.prototype,
      'deleteFood',
    )?.value;
    expect(Reflect.getMetadata(GUARDS_METADATA, adminDelete)).toContain(RolesGuard);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, adminDelete)).toEqual([Permission.FOOD.DELETE]);
  });

  it('protects Catalog category writes and keeps reads public', () => {
    const readMethod = Object.getOwnPropertyDescriptor(
      CategoryController.prototype,
      'findAll',
    )?.value;
    expect(Reflect.getMetadata(GUARDS_METADATA, readMethod)).toBeUndefined();
    const writeMethod = Object.getOwnPropertyDescriptor(
      CategoryController.prototype,
      'create',
    )?.value;
    expect(Reflect.getMetadata(GUARDS_METADATA, writeMethod)).toContain(RolesGuard);
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
