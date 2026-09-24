import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import * as moment from 'moment';
import { randomUUID } from 'node:crypto';
import { Role } from 'src/entities/role.entity';
import { User } from 'src/entities/user.entity';
import { AddressService } from 'src/features/locations/address-write.public-api';
import { AuthProvider } from 'src/shared/types/enums/auth-provider.enum';
import { DefaultRole } from 'src/shared/types/enums/default-role.enum';
import { EntityManager, Repository } from 'typeorm';
import { CreateUserDto } from '../dto/create-users.dto';
import { UpdateUserDto } from '../dto/update-users.dto';
import { UserResponse } from '../interfaces/user-response.interface';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly addressService: AddressService,
  ) {}

  async updateUserProvider(
    id: string,
    arg1: { provider: AuthProvider; googleId: string },
  ): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new Error(`User with id ${id} not found`);
    }
    user.authProvider = arg1.provider;
    user.googleId = arg1.googleId;
    return this.usersRepository.save(user);
  }
  // Lấy thông tin người dùng hiện tại dựa trên id (Firebase UID)
  async getMe(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new Error(`User with id ${id} not found`);
    }
    return user;
  }

  // Cập nhật thông tin cá nhân của người dùng hiện tại
  async updateMe(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    this.logger.log(`Start updating user with id: ${id}`);
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['address'],
    });
    if (!user) {
      this.logger.warn(`User not found: ${id}`);
      throw new Error('User not found');
    }

    const { addresses, ...updateData } = updateUserDto;
    this.logger.debug(`Update data for user ${id}: ${JSON.stringify(updateData)}`);

    // Handle password hashing if needed
    if (updateData.password) {
      this.logger.log(`Hashing password for user: ${id}`);
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    Object.assign(user, updateData);

    // --- Address update logic ---
    if (addresses) {
      this.logger.log(`Removing old addresses for user: ${id}`);
      await this.addressService.replaceOwnedAddresses(user.id, addresses);
    }

    this.logger.log(`Saving updated user: ${id}`);
    await this.usersRepository.save(user);
    this.logger.log(`User updated successfully: ${id}`);
    return (await this.usersRepository.findOne({
      where: { id },
      relations: ['address'],
    })) as User;
  }
  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  async findByUsernameWithRole(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username }, relations: ['role'] });
  }

  async createShipperAccount(data: {
    username: string;
    password: string;
    name: string;
    phone: string;
    birthday: Date;
  }, manager?: EntityManager): Promise<User> {
    const users = manager?.getRepository(User) ?? this.usersRepository;
    const roles = manager?.getRepository(Role) ?? this.rolesRepository;
    const existing = await users.findOne({ where: { username: data.username } });
    if (existing) {
      throw new Error('USERNAME_ALREADY_EXISTS');
    }

    const role = await roles.findOne({ where: { name: DefaultRole.SHIPPER } });
    if (!role) {
      throw new Error('SHIPPER_ROLE_NOT_FOUND');
    }

    return users.save(
      users.create({
        ...data,
        id: randomUUID().substring(0, 28),
        password: await bcrypt.hash(data.password, 10),
        role,
        isActive: true,
      }),
    );
  }
  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      // Find role
      const role = await this.rolesRepository.findOne({
        where: { id: createUserDto.role },
      });

      if (!role) {
        throw new Error('Role not found');
      }

      // Generate UUID for user ID
      const userId = randomUUID().substring(0, 28); // Generate a new UUID if not provided

      // Hash password
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

      // Create user with hashed password
      const user = this.usersRepository.create({
        ...createUserDto,
        id: userId,
        password: hashedPassword,
        role: role,
      });

      return await this.usersRepository.save(user);
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to create user: ${error.message}`);
      }
      throw new Error('Failed to create user: Unknown error');
    }
  }

  async findByPhone(phone: string) {
    return this.usersRepository.findOne({
      where: { phone },
      relations: ['role'],
    });
  }

  async register(createUserDto: CreateUserDto, id: string): Promise<User> {
    const role = await this.rolesRepository.findOne({
      where: { name: DefaultRole.USER },
    });

    if (!role) {
      throw new Error('Default User role not found');
    }
    if (!id) {
      const uuid: string = randomUUID().substring(0, 28); // Generate a new UUID if not provided
      id = uuid; // Generate a new UUID if not provided
    }
    const user = this.usersRepository.create({
      ...createUserDto,
      id: id,

      password: await bcrypt.hash(createUserDto.password, 10),
      role: role,
    });

    return this.usersRepository.save(user);
  }
  async findAll(): Promise<UserResponse[]> {
    const users = await this.usersRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.name',
        'user.username',
        'user.avatar',
        'user.email',
        'user.createdAt',
        'user.lastLoginAt',
      ])
      .getMany();

    return users.map((user) => {
      // Calculate status based on last login
      const lastLogin = user.lastLoginAt ? moment(user.lastLoginAt) : null;
      let status = 'Active';
      if (lastLogin) {
        const daysAgo = moment().diff(lastLogin, 'days');
        if (daysAgo > 0) {
          status = `${daysAgo} days ago`;
        }
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: moment(user.createdAt).format('DD-MM-YYYY'),
        status,
      };
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['role', 'role.permissions'],
    });

    if (!user) {
      throw new Error(`User with id ${id} not found`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    // Same logic as updateMe, but for admin update
    return this.updateMe(id, updateUserDto);
  }

  async updatePassword(id: string, password: string): Promise<User> {
    const user = await this.findOne(id);
    user.password = await bcrypt.hash(password, 10);
    return this.usersRepository.save(user);
  }
  async remove(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }
  // async createMany(users: User[]) {
  //     const queryRunner = this.dataSource.createQueryRunner();

  //     await queryRunner.connect();
  //     await queryRunner.startTransaction();
  //     try {
  //       await queryRunner.manager.save(users[0]);
  //       await queryRunner.manager.save(users[1]);

  //       await queryRunner.commitTransaction();
  //     } catch (err) {
  //       // since we have errors lets rollback the changes we made
  //       await queryRunner.rollbackTransaction();
  //     } finally {
  //       // you need to release a queryRunner which was manually instantiated
  //       await queryRunner.release();
  //     }
  //   }
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }


  async issuePasswordResetToken(
    email: string,
    hashedToken: string,
    expiresAt: Date,
  ): Promise<{ email: string; name?: string } | null> {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      return null;
    }

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = expiresAt;
    const saved = await this.usersRepository.save(user);
    return { email: saved.email, name: saved.name };
  }

  async findPasswordResetState(
    email: string,
    hashedToken: string,
  ): Promise<{ userId: string; email: string; name?: string; expiresAt?: Date } | null> {
    const user = await this.usersRepository.findOne({
      where: { email, resetPasswordToken: hashedToken },
    });
    return user
      ? {
          userId: user.id,
          email: user.email,
          name: user.name,
          expiresAt: user.resetPasswordExpires,
        }
      : null;
  }

  async completePasswordReset(userId: string, newPassword: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error(`User with id ${userId} not found`);
    }
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = new Date();
    await this.usersRepository.save(user);
  }
}
