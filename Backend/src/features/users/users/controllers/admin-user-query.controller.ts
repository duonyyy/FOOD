import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Permissions, RolesGuard } from 'src/features/auth/public-api';
import { Permission } from 'src/shared/types/enums/permission.enum';
import {
  IdentityUserListItemDto,
  IdentityUserResponseDto,
} from '../dto/identity-user-response.dto';
import { IdentityUserQueryService } from '../services/identity-user-query.service';

@ApiTags('users')
@Controller('users')
export class AdminUserQueryController {
  constructor(private readonly identityUserQueryService: IdentityUserQueryService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Permissions(Permission.USER.READ)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List users for an authorized administrator' })
  @ApiResponse({ status: 200, type: [IdentityUserListItemDto] })
  @ApiResponse({ status: 403, description: 'Missing user read permission' })
  listUsers(): Promise<IdentityUserListItemDto[]> {
    return this.identityUserQueryService.listUsers();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Permissions(Permission.USER.READ)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get a user for an authorized administrator' })
  @ApiResponse({ status: 200, type: IdentityUserResponseDto })
  @ApiResponse({ status: 403, description: 'Missing user read permission' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id') userId: string): Promise<IdentityUserResponseDto> {
    return this.identityUserQueryService.findUserById(userId);
  }
}
