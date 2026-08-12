import { Body, Controller, Delete, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from 'src/auth/decorators/permissions.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Permission } from 'src/constants/permission.enum';
import { Role } from 'src/entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './role.service';

/** Legacy role commands. Identity owns all role and permission read APIs. */
@Controller('role')
@ApiTags('roles')
@ApiBearerAuth('bearer')
export class RoleController {
  constructor(private readonly roleService: RolesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Permissions(Permission.ROLE.CREATE)
  create(@Body() createRoleDto: CreateRoleDto): Promise<Role> {
    return this.roleService.createRole(createRoleDto);
  }

  @Put(':id/permissions')
  @UseGuards(RolesGuard)
  @Permissions(Permission.ROLE.WRITE)
  updateRolePermissions(@Param('id') roleId: string, @Body('permissions') permissions: string[]) {
    return this.roleService.updateRolePermissions(roleId, permissions);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Permissions(Permission.ROLE.WRITE)
  updateRoleDetails(@Param('id') roleId: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.roleService.updateRoleDetails(roleId, updateRoleDto);
  }

  @Post(':id/users')
  @UseGuards(RolesGuard)
  @Permissions(Permission.ROLE.WRITE)
  addUsersToRole(@Param('id') roleId: string, @Body('userIds') userIds: string[]) {
    return this.roleService.addUsersToRole(roleId, userIds);
  }

  @Post(':id/assign-users')
  @UseGuards(RolesGuard)
  @Permissions(Permission.ROLE.WRITE)
  assignUsersToRole(@Param('id') roleId: string, @Body('userIds') userIds: string[]) {
    return this.roleService.assignUsersToRole(roleId, userIds);
  }

  @Post(':id/users/remove')
  @UseGuards(RolesGuard)
  @Permissions(Permission.ROLE.WRITE)
  removeUsersFromRole(@Param('id') roleId: string, @Body('userIds') userIds: string[]) {
    return this.roleService.removeUsersFromRole(roleId, userIds);
  }

  @Post(':id/permissions')
  @UseGuards(RolesGuard)
  @Permissions(Permission.ROLE.WRITE)
  addPermissionsToRole(@Param('id') roleId: string, @Body('permissions') permissions: string[]) {
    return this.roleService.addPermissionsToRole(roleId, permissions);
  }

  @Post(':id/permissions/remove')
  @UseGuards(RolesGuard)
  @Permissions(Permission.ROLE.WRITE)
  removePermissionsFromRole(
    @Param('id') roleId: string,
    @Body('permissions') permissions: string[],
  ) {
    return this.roleService.removePermissionsFromRole(roleId, permissions);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Permissions(Permission.ROLE.DELETE)
  async remove(@Param('id') roleId: string): Promise<{ message: string }> {
    await this.roleService.deleteRole(roleId);
    return { message: 'Role deleted successfully' };
  }
}
