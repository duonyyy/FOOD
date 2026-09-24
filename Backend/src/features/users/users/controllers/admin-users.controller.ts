import { Body, Controller, Delete, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions, RolesGuard } from 'src/features/auth/public-api';
import { Permission } from 'src/shared/types/enums/permission.enum';
import { CreateUserDto } from '../dto/create-users.dto';
import { UpdateUserDto } from '../dto/update-users.dto';
import { SafeUserResponse, toSafeUserResponse } from '../mappers/safe-user-response.mapper';
import { AdminUsersService } from '../services/admin-users.service';
import { UserProfileService } from '../services/user-profile.service';

@Controller('users')
@ApiTags('users')
export class AdminUsersController {
  constructor(
    private readonly adminUsers: AdminUsersService,
    private readonly profiles: UserProfileService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Permissions(Permission.USER.CREATE)
  @ApiBearerAuth('bearer')
  async create(@Body() createUserDto: CreateUserDto): Promise<SafeUserResponse> {
    return toSafeUserResponse(await this.adminUsers.create(createUserDto));
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Permissions(Permission.USER.WRITE)
  @ApiBearerAuth('bearer')
  async update(
    @Param('id') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<SafeUserResponse> {
    return toSafeUserResponse(await this.profiles.update(userId, updateUserDto));
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Permissions(Permission.USER.DELETE)
  @ApiBearerAuth('bearer')
  async remove(@Param('id') userId: string): Promise<void> {
    await this.adminUsers.remove(userId);
  }
}
