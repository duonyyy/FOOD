import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { Role } from 'src/entities/role.entity';
import { User } from 'src/entities/user.entity';
import { Repository } from 'typeorm';
import { CreateUserDto } from '../dto/create-users.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      const role = await this.rolesRepository.findOne({
        where: { id: createUserDto.role },
      });
      if (!role) {
        throw new Error('Role not found');
      }

      const userId = randomUUID().substring(0, 28);
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
      const user = this.usersRepository.create({
        ...createUserDto,
        id: userId,
        password: hashedPassword,
        role,
      });

      return await this.usersRepository.save(user);
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to create user: ${error.message}`);
      }
      throw new Error('Failed to create user: Unknown error');
    }
  }

  async remove(userId: string): Promise<void> {
    await this.usersRepository.delete(userId);
  }
}
