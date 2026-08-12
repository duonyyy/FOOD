import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Permissions } from 'src/auth/decorators/permissions.decorator';
import { Permission } from 'src/constants/permission.enum';
import {
  CurrentActor,
  type CurrentActor as CurrentActorData,
} from '../contracts/current-actor.decorator';
import { AuthGuard, RolesGuard } from '../public-api';
import { IdentityUserListItemDto } from '../users/dto/identity-user-response.dto';
import { AvailableRoleUsersQueryDto } from './dto/available-role-users-query.dto';
import {
  IdentityPermissionResponseDto,
  IdentityRoleDetailResponseDto,
  IdentityRoleResponseDto,
} from './dto/identity-role-response.dto';
import { IdentityRoleQueryService } from './identity-role-query.service';

@ApiTags('roles')
@Controller('role')
export class IdentityRoleQueryController {
  constructor(private readonly identityRoleQueryService: IdentityRoleQueryService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Permissions(Permission.ROLE.READ)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List roles for an authorized administrator' })
  @ApiResponse({ status: 200, type: [IdentityRoleResponseDto] })
  listRoles(): Promise<IdentityRoleResponseDto[]> {
    return this.identityRoleQueryService.listRoles();
  }

  @Get('permissions')
  @UseGuards(RolesGuard)
  @Permissions(Permission.ROLE.READ)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List supported permission names' })
  @ApiResponse({ status: 200, type: [String] })
  listPermissionNames(): string[] {
    return Object.values(Permission).flatMap((group) =>
      typeof group === 'string' ? [group] : Object.values(group),
    );
  }

  @Get('user-role-and-permission')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get the current administrative role for the admin portal' })
  @ApiResponse({ status: 200, schema: { example: { role: { name: 'administrator' } } } })
  @ApiResponse({ status: 403, description: 'Actor is not an administrator' })
  async getCurrentAdminRole(@CurrentActor() actor: CurrentActorData) {
    const roleStatus = await this.identityRoleQueryService.getAdminRoleStatus(actor.userId);
    return { role: { name: roleStatus.roleName } };
  }

  @Get('user/:userId/permissions')
  @UseGuards(RolesGuard)
  @Permissions(Permission.ROLE.READ, Permission.USER.READ)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List active permissions for a user' })
  @ApiResponse({ status: 200, type: [IdentityPermissionResponseDto] })
  listUserPermissions(@Param('userId') userId: string): Promise<IdentityPermissionResponseDto[]> {
    return this.identityRoleQueryService.listUserPermissions(userId);
  }

  @Get('check-permission/:roleId/:permissionName')
  @UseGuards(RolesGuard)
  @Permissions(Permission.ROLE.READ)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Check whether a role has an active permission' })
  hasPermission(
    @Param('roleId') roleId: string,
    @Param('permissionName') permissionName: string,
  ): Promise<boolean> {
    return this.identityRoleQueryService.hasPermission(roleId, permissionName);
  }

  @Get(':id/users/available')
  @UseGuards(RolesGuard)
  @Permissions(Permission.ROLE.READ, Permission.USER.READ)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List users available for a role assignment' })
  @ApiResponse({ status: 200, type: [IdentityUserListItemDto] })
  listAvailableUsers(
    @Param('id') roleId: string,
    @Query() query: AvailableRoleUsersQueryDto,
  ): Promise<IdentityUserListItemDto[]> {
    return this.identityRoleQueryService.listAvailableUsers(roleId, query.limit, query.search);
  }

  @Get(':id/permissions')
  @UseGuards(RolesGuard)
  @Permissions(Permission.ROLE.READ)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List active permission names for a role' })
  @ApiResponse({ status: 200, type: [String] })
  listRolePermissions(@Param('id') roleId: string): Promise<string[]> {
    return this.identityRoleQueryService.listRolePermissionNames(roleId);
  }

  @Get(':id/users')
  @UseGuards(RolesGuard)
  @Permissions(Permission.ROLE.READ, Permission.USER.READ)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List safe user summaries assigned to a role' })
  @ApiResponse({ status: 200, type: [IdentityUserListItemDto] })
  listRoleUsers(@Param('id') roleId: string): Promise<IdentityUserListItemDto[]> {
    return this.identityRoleQueryService.listRoleUsers(roleId);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Permissions(Permission.ROLE.READ)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get a role with safe user and permission summaries' })
  @ApiResponse({ status: 200, type: IdentityRoleDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Role not found' })
  findRole(@Param('id') roleId: string): Promise<IdentityRoleDetailResponseDto> {
    return this.identityRoleQueryService.findRoleById(roleId);
  }
}
