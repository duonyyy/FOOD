import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { PERMISSIONS_KEY } from 'src/features/auth/decorators/permissions.decorator';
import { AuthGuard } from 'src/features/auth/guards/auth.guard';
import { RolesGuard } from 'src/features/auth/guards/roles.guard';
import { AdminUsersController } from 'src/features/users/users/controllers/admin-users.controller';
import { CurrentUserController } from 'src/features/users/users/controllers/current-user.controller';
import { AdminUsersService } from 'src/features/users/users/services/admin-users.service';
import { UserProfileService } from 'src/features/users/users/services/user-profile.service';
import { Permission } from 'src/shared/types/enums/permission.enum';

describe('Users command controllers', () => {
  let currentUser: CurrentUserController;
  let adminUsers: AdminUsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CurrentUserController, AdminUsersController],
      providers: [
        {
          provide: AdminUsersService,
          useValue: {},
        },
        { provide: UserProfileService, useValue: {} },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    currentUser = module.get<CurrentUserController>(CurrentUserController);
    adminUsers = module.get<AdminUsersController>(AdminUsersController);
  });

  it('should be defined', () => {
    expect(currentUser).toBeDefined();
    expect(adminUsers).toBeDefined();
  });

  it('keeps current-user and admin commands on their existing guarded paths', () => {
    const currentMethod = Object.getOwnPropertyDescriptor(
      CurrentUserController.prototype,
      'updateMe',
    )?.value as object;
    expect(Reflect.getMetadata(PATH_METADATA, currentMethod)).toBe('me');
    expect(Reflect.getMetadata(GUARDS_METADATA, currentMethod)).toContain(AuthGuard);

    for (const [methodName, path, permission] of [
      ['create', '/', Permission.USER.CREATE],
      ['update', ':id', Permission.USER.WRITE],
      ['remove', ':id', Permission.USER.DELETE],
    ] as const) {
      const method = Object.getOwnPropertyDescriptor(AdminUsersController.prototype, methodName)
        ?.value as object;
      expect(Reflect.getMetadata(PATH_METADATA, method)).toBe(path);
      expect(Reflect.getMetadata(GUARDS_METADATA, method)).toContain(RolesGuard);
      expect(Reflect.getMetadata(PERMISSIONS_KEY, method)).toEqual([permission]);
    }
  });
});
