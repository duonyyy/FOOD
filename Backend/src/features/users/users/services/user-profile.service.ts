import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from 'src/entities/user.entity';
import { AddressService } from 'src/features/locations/public-api';
import { Repository } from 'typeorm';
import { UpdateUserDto } from '../dto/update-users.dto';

@Injectable()
export class UserProfileService {
  private readonly logger = new Logger(UserProfileService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly addressService: AddressService,
  ) {}

  /** Shared profile update for the authenticated user and authorized administrators. */
  async update(userId: string, updateUserDto: UpdateUserDto): Promise<User> {
    this.logger.log(`Start updating user with id: ${userId}`);
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['address'],
    });
    if (!user) {
      this.logger.warn(`User not found: ${userId}`);
      throw new Error('User not found');
    }

    const { addresses, ...updateData } = updateUserDto;

    if (updateData.password) {
      this.logger.log(`Hashing password for user: ${userId}`);
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    Object.assign(user, updateData);

    if (addresses) {
      this.logger.log(`Removing old addresses for user: ${userId}`);
      await this.addressService.replaceOwnedAddresses(user.id, addresses);
    }

    this.logger.log(`Saving updated user: ${userId}`);
    await this.usersRepository.save(user);
    this.logger.log(`User updated successfully: ${userId}`);
    return (await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['address'],
    })) as User;
  }
}
