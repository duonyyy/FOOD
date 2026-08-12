import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as moment from 'moment';
import { User } from 'src/entities/user.entity';
import { Repository } from 'typeorm';
import {
  type IdentityReaderPort,
  type IdentityUserSnapshot,
} from '../contracts/identity-reader.port';
import { IdentityUserListItemDto, IdentityUserResponseDto } from './dto/identity-user-response.dto';
import { toIdentityUserListItem, toIdentityUserResponse } from './identity-user.mapper';

@Injectable()
export class IdentityUserQueryService implements IdentityReaderPort {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findCurrentUser(userId: string): Promise<IdentityUserResponseDto> {
    return toIdentityUserResponse(await this.requireUser(userId));
  }

  async findUserById(userId: string): Promise<IdentityUserResponseDto> {
    return toIdentityUserResponse(await this.requireUser(userId));
  }

  async listUsers(): Promise<IdentityUserListItemDto[]> {
    const users = await this.userRepository
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

    return users.map((user) => toIdentityUserListItem(user, this.toStatus(user)));
  }

  async findIdentityUser(userId: string): Promise<IdentityUserSnapshot | null> {
    const user = await this.userRepository.findOne({ where: { id: userId }, relations: ['role'] });
    return user
      ? {
          userId: user.id,
          username: user.username,
          name: user.name ?? null,
          roleName: user.role?.name ?? null,
          isActive: Boolean(user.isActive),
        }
      : null;
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId }, relations: ['role'] });
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
    return user;
  }

  private toStatus(user: Pick<User, 'lastLoginAt'>): string {
    if (!user.lastLoginAt) {
      return 'Active';
    }

    const daysAgo = moment().diff(moment(user.lastLoginAt), 'days');
    return daysAgo > 0 ? `${daysAgo} days ago` : 'Active';
  }
}
