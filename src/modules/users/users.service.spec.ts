import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Address } from 'src/entities/address.entity';
import { Role } from 'src/entities/role.entity';
import { User } from 'src/entities/user.entity';
import { DataSource } from 'typeorm';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(Role), useValue: {} },
        { provide: getRepositoryToken(Address), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
