import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Role } from 'src/entities/role.entity';
import { User } from 'src/entities/user.entity';
import { AddressService } from 'src/features/locations/address-write.public-api';
import { UsersService } from 'src/features/users/services/users.service';

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
        { provide: AddressService, useValue: { replaceOwnedAddresses: jest.fn() } },
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
});
