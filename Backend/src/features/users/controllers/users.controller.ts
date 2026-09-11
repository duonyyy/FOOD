import { Body, Controller, Delete, Logger, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Permission } from 'src/constants/permission.enum';
import { AuthGuard, Permissions, RolesGuard } from 'src/features/auth/public-api';
import {
  CurrentActor,
  type CurrentActor as CurrentActorData,
} from 'src/features/users/contracts/current-actor.decorator';
import { CreateUserDto } from '../dto/create-users.dto';
import { UpdateMeDto } from '../dto/update-me.dto';
import { UpdateUserDto } from '../dto/update-users.dto';
import { SafeUserResponse, toSafeUserResponse } from '../mappers/safe-user-response.mapper';
import { UsersService } from '../services/users.service';

/** Legacy user command controller. Delivery owns shipper operations. */
@Controller('users')
@ApiTags('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Put('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update the current user profile (legacy address compatibility)' })
  @ApiResponse({ status: 200, description: 'Safe user response' })
  async updateMe(
    @CurrentActor() actor: CurrentActorData,
    @Body() body: UpdateMeDto,
  ): Promise<SafeUserResponse> {
    const userUpdate: UpdateUserDto = {
      name: body.name,
      phone: body.phone,
      avatar: body.avatar,
      birthday: body.birthday,
      addresses: body.addresses ?? body.address,
    };
    this.logger.debug(`User profile update requested for ${actor.userId}`);

    return toSafeUserResponse(await this.usersService.updateMe(actor.userId, userUpdate));
  }

  @Post()
  @UseGuards(RolesGuard)
  @Permissions(Permission.USER.CREATE)
  @ApiBearerAuth('bearer')
  async create(@Body() createUserDto: CreateUserDto): Promise<SafeUserResponse> {
    return toSafeUserResponse(await this.usersService.create(createUserDto));
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Permissions(Permission.USER.WRITE)
  @ApiBearerAuth('bearer')
  async update(
    @Param('id') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<SafeUserResponse> {
    return toSafeUserResponse(await this.usersService.update(userId, updateUserDto));
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Permissions(Permission.USER.DELETE)
  @ApiBearerAuth('bearer')
  async remove(@Param('id') userId: string): Promise<void> {
    await this.usersService.remove(userId);
  }
}
