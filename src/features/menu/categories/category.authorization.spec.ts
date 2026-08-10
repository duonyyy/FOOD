import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from 'src/auth/decorators/permissions.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Permission } from 'src/constants/permission.enum';
import { CategoryController } from './category.controller';

describe('Category authorization policy', () => {
  it('keeps category reads public', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      Object.getOwnPropertyDescriptor(CategoryController.prototype, 'findAll')?.value,
    );

    expect(guards).toBeUndefined();
  });

  it.each([
    ['create', Permission.CATEGORY.CREATE],
    ['update', Permission.CATEGORY.WRITE],
    ['remove', Permission.CATEGORY.DELETE],
  ])('protects %s with the catalog permission', (methodName, permission) => {
    const method = Object.getOwnPropertyDescriptor(CategoryController.prototype, methodName)?.value;
    const guards = Reflect.getMetadata(GUARDS_METADATA, method) as unknown[];
    const permissions = Reflect.getMetadata(PERMISSIONS_KEY, method) as string[];

    expect(guards).toContain(RolesGuard);
    expect(permissions).toEqual([permission]);
  });

  it('does not place a broad class-level guard over public reads', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, CategoryController)).toBeUndefined();
    expect(new Reflector()).toBeDefined();
  });
});
