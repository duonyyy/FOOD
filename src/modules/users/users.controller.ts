import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { log } from 'console';
import { Permissions } from 'src/auth/decorators/permissions.decorator';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Permission } from 'src/constants/permission.enum';
import { CertificateStatus } from 'src/entities/shipperCertificateInfo.entity';
import { CreateUserDto } from './dto/create-users.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateUserDto } from './dto/update-users.dto';
import { UserResponse } from './interface/user-response.interface';
import { SafeUserResponse, toSafeUserResponse } from './mappers/safe-user-response.mapper';
import { UsersService } from './users.service';

@Controller('users')
@ApiTags('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(AuthGuard) // Verify Firebase token
  async getMe(@Req() req): Promise<SafeUserResponse> {
    const id = req.user.uid;
    return toSafeUserResponse(await this.usersService.getMe(id));
  }

  @Get('shippers')
  @UseGuards(RolesGuard)
  @Permissions(Permission.SHIPPER.READ)
  getShippers(@Query('status') status?: CertificateStatus) {
    return this.usersService.getShippersByStatus(status);
  }

  @Put('me')
  @UseGuards(AuthGuard)
  async updateMe(@Req() req, @Body() body: UpdateMeDto): Promise<SafeUserResponse> {
    const id = req.user.uid;
    const mappedUser: UpdateUserDto = {
      name: body.name,
      phone: body.phone,
      avatar: body.avatar,
      birthday: body.birthday,
      addresses: body.addresses ?? body.address,
    };
    log('Updating user with ID:', id, 'Mapped user data:', mappedUser);

    return toSafeUserResponse(await this.usersService.updateMe(id, mappedUser));
  }

  @Post()
  @UseGuards(RolesGuard)
  @Permissions(Permission.USER.CREATE)
  async create(@Body() createUserDto: CreateUserDto) {
    return toSafeUserResponse(await this.usersService.create(createUserDto));
  }

  @Get()
  @UseGuards(RolesGuard)
  @Permissions(Permission.USER.READ)
  async findAll(): Promise<UserResponse[]> {
    return await this.usersService.findAll();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Permissions(Permission.USER.READ)
  async findOne(@Param('id') id: string) {
    return toSafeUserResponse(await this.usersService.findOne(id));
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Permissions(Permission.USER.WRITE)
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return toSafeUserResponse(await this.usersService.update(id, updateUserDto));
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Permissions(Permission.USER.DELETE)
  async remove(@Param('id') id: string) {
    return await this.usersService.remove(id);
  }

  @Patch('shippers/:userId/approve')
  @UseGuards(RolesGuard)
  @Permissions(Permission.SHIPPER.WRITE)
  async approveShipper(@Param('userId') id: string) {
    return this.usersService.updateShipperStatus(id, CertificateStatus.APPROVED);
  }

  @Patch('shippers/:userId/reject')
  @UseGuards(RolesGuard)
  @Permissions(Permission.SHIPPER.WRITE)
  async rejectShipper(@Param('userId') id: string) {
    return this.usersService.updateShipperStatus(id, CertificateStatus.REJECTED);
  }

  // @Patch('shippers/approve-myself')
  // @UseGuards(AuthGuard)
  // approveMyself(@Req() req) {
  //   const userId = req.user.id;
  //   return this.usersService.updateShipperStatus(userId, CertificateStatus.APPROVED);
  // }
}
