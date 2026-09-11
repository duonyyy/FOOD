import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Permission } from 'src/entities/permission.entity';
import { Role } from 'src/entities/role.entity';
import { User } from 'src/entities/user.entity';
import { RolesService } from 'src/features/users/roles/role.service';

describe('RoleService', () => {
  let service: RolesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getRepositoryToken(Role), useValue: {} },
        { provide: getRepositoryToken(Permission), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return roles with user counts using a single group query', async () => {
    const mockRoleRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 'role-1', name: 'ADMIN' },
        { id: 'role-2', name: 'USER' },
      ]),
    };
    const mockUserRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ roleId: 'role-1', count: '5' }]),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
        { provide: getRepositoryToken(Permission), useValue: {} },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();

    const roleService = module.get<RolesService>(RolesService);
    const result = await roleService.findAll();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 'role-1', name: 'ADMIN', userCount: 5 });
    expect(result[1]).toEqual({ id: 'role-2', name: 'USER', userCount: 0 });
    expect(mockUserRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
  });
});
