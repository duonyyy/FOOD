import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Permissions } from 'src/auth/decorators/permissions.decorator';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Permission } from 'src/constants/permission.enum';
import { CertificateStatus } from 'src/entities/shipperCertificateInfo.entity';
import {
  CurrentActor,
  type CurrentActor as CurrentActorData,
} from 'src/features/identity/contracts/current-actor.decorator';
import { CreateUserDto } from './dto/create-users.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateUserDto } from './dto/update-users.dto';
import { SafeUserResponse, toSafeUserResponse } from './mappers/safe-user-response.mapper';
import { UsersService } from './users.service';

/** Legacy command and Delivery-compatibility controller. Identity owns User queries. */
@Controller('users')
@ApiTags('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get('shippers')
  @UseGuards(RolesGuard)
  @Permissions(Permission.SHIPPER.READ)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List shipper compatibility projections' })
  @ApiResponse({ status: 200, description: 'Safe user projections for delivery compatibility' })
  async getShippers(@Query('status') status?: CertificateStatus) {
    const shippers = await this.usersService.getShippersByStatus(status);
    return shippers.map((shipper) => ({
      id: shipper.id,
      status: shipper.status,
      verifiedAt: shipper.verifiedAt,
      user: shipper.user ? toSafeUserResponse(shipper.user) : null,
    }));
  }

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

  @Patch('shippers/:userId/approve')
  @UseGuards(RolesGuard)
  @Permissions(Permission.SHIPPER.WRITE)
  @ApiBearerAuth('bearer')
  approveShipper(@Param('userId') userId: string) {
    return this.usersService.updateShipperStatus(userId, CertificateStatus.APPROVED);
  }

  @Patch('shippers/:userId/reject')
  @UseGuards(RolesGuard)
  @Permissions(Permission.SHIPPER.WRITE)
  @ApiBearerAuth('bearer')
  rejectShipper(@Param('userId') userId: string) {
    return this.usersService.updateShipperStatus(userId, CertificateStatus.REJECTED);
  }
}
