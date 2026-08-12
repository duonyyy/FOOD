import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Permissions } from 'src/auth/decorators/permissions.decorator';
import { Permission } from 'src/constants/permission.enum';
import {
  CurrentActor,
  type CurrentActor as CurrentActorData,
} from '../contracts/current-actor.decorator';
import { AuthGuard, RolesGuard } from '../public-api';
import { IdentityUserListItemDto, IdentityUserResponseDto } from './dto/identity-user-response.dto';
import { IdentityUserQueryService } from './identity-user-query.service';

@ApiTags('users')
@Controller('users')
export class IdentityUserQueryController {
  constructor(private readonly identityUserQueryService: IdentityUserQueryService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiResponse({ status: 200, type: IdentityUserResponseDto })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  findMe(@CurrentActor() actor: CurrentActorData): Promise<IdentityUserResponseDto> {
    return this.identityUserQueryService.findCurrentUser(actor.userId);
  }

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
