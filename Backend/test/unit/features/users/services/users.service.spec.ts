import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Role } from 'src/entities/role.entity';
import { User } from 'src/entities/user.entity';
import { UsersService } from 'src/features/users/users/services/users.service';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: { findOne: jest.Mock };

  beforeEach(async () => {
    userRepository = { findOne: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(Role), useValue: {} },
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('loads phone lookup with Identity relations only', async () => {
    await service.findByPhone('0900000000');

    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { phone: '0900000000' },
      relations: ['role'],
    });
  });

  it('uses only repositories from the supplied transaction for shipper account creation', async () => {
    const role = { id: 'shipper-role', name: 'shipper' };
    const usersInTransaction = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value: unknown) => value),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
    };
    const rolesInTransaction = { findOne: jest.fn().mockResolvedValue(role) };
    const manager = {
      getRepository: jest.fn((entity: unknown) =>
        entity === User ? usersInTransaction : rolesInTransaction,
      ),
    };

    const user = await service.createShipperAccount(
      {
        username: '0901234567',
        password: 'password123',
        name: 'Shipper',
        phone: '0901234567',
        birthday: new Date('1999-01-01'),
      },
      manager as never,
    );

    expect(manager.getRepository).toHaveBeenCalledWith(User);
    expect(manager.getRepository).toHaveBeenCalledWith(Role);
    expect(usersInTransaction.save).toHaveBeenCalledTimes(1);
    expect(user).toMatchObject({ username: '0901234567', role });
    expect(user.password).not.toBe('password123');
    expect(userRepository.findOne).not.toHaveBeenCalled();
  });
});
