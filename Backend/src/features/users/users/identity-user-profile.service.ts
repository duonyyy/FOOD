import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/entities/user.entity';
import { Repository } from 'typeorm';
import type {
  IdentityUserProfileView,
  UpdateIdentityUserProfileCommand,
} from '../types/identity-user-profile.types';

@Injectable()
export class IdentityUserProfileService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findProfile(userId: string): Promise<IdentityUserProfileView | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    return user ? this.toView(user) : null;
  }

  async updateProfile(
    userId: string,
    command: UpdateIdentityUserProfileCommand,
  ): Promise<IdentityUserProfileView> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');

    if (command.name !== undefined) user.name = command.name;
    if (command.phone !== undefined) user.phone = command.phone;
    if (command.birthday !== undefined) user.birthday = command.birthday;

    return this.toView(await this.userRepository.save(user));
  }

  private toView(user: User): IdentityUserProfileView {
    return {
      userId: user.id,
      name: user.name ?? null,
      phone: user.phone ?? null,
      birthday: user.birthday ?? null,
    };
  }
}
