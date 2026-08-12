import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DefaultRole, Role } from 'src/entities/role.entity';
import { User } from 'src/entities/user.entity';
import { Repository } from 'typeorm';
import { IdentityUserListItemDto } from '../users/dto/identity-user-response.dto';
import { toIdentityUserListItem } from '../users/identity-user.mapper';
import {
  IdentityPermissionResponseDto,
  IdentityRoleDetailResponseDto,
  IdentityRoleResponseDto,
} from './dto/identity-role-response.dto';
import {
  toIdentityPermissionResponse,
  toIdentityRoleDetailResponse,
  toIdentityRoleResponse,
} from './identity-role.mapper';

@Injectable()
export class IdentityRoleQueryService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async listRoles(): Promise<IdentityRoleResponseDto[]> {
    const roles = await this.roleRepository.find();
    const userCounts = await this.userRepository
      .createQueryBuilder('user')
      .select('user.role_id', 'roleId')
      .addSelect('COUNT(user.id)', 'count')
      .groupBy('user.role_id')
      .getRawMany<{ roleId: string; count: string }>();
    const userCountByRoleId = new Map(
      userCounts.map((count) => [count.roleId, Number(count.count)]),
    );

    return roles.map((role) => toIdentityRoleResponse(role, userCountByRoleId.get(role.id) ?? 0));
  }

  async findRoleById(roleId: string): Promise<IdentityRoleDetailResponseDto> {
    const role = await this.requireRole(roleId, ['permissions', 'users']);
    return toIdentityRoleDetailResponse(role, await this.countUsers(role.id));
  }

  async listRolePermissionNames(roleId: string): Promise<string[]> {
    const role = await this.requireRole(roleId, ['permissions']);
    return role.permissions
      .filter((permission) => permission.isActive)
      .map((permission) => permission.name);
  }

  async listUserPermissions(userId: string): Promise<IdentityPermissionResponseDto[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role', 'role.permissions'],
    });
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    return (user.role?.permissions ?? [])
      .filter((permission) => permission.isActive)
      .map(toIdentityPermissionResponse);
  }

  async listRoleUsers(roleId: string): Promise<IdentityUserListItemDto[]> {
    const role = await this.requireRole(roleId, ['users']);
    return (role.users ?? []).map((user) => toIdentityUserListItem(user, 'Active'));
  }

  async listAvailableUsers(
    roleId: string,
    limit?: number,
    searchTerm?: string,
  ): Promise<IdentityUserListItemDto[]> {
    await this.requireRole(roleId);
    const superAdminRole = await this.roleRepository.findOne({
      where: { name: DefaultRole.SUPER_ADMIN },
    });
    const query = this.userRepository
      .createQueryBuilder('user')
      .leftJoin('user.role', 'role')
      .where('role.id != :roleId', { roleId });

    if (superAdminRole) {
      query.andWhere('role.id != :superAdminRoleId', { superAdminRoleId: superAdminRole.id });
    }
    if (searchTerm) {
      query.andWhere(
        '(user.name ILIKE :searchTerm OR user.username ILIKE :searchTerm OR user.email ILIKE :searchTerm)',
        { searchTerm: `%${searchTerm}%` },
      );
    }
    if (limit) {
      query.take(limit);
    }

    const users = await query.orderBy('user.name', 'ASC').getMany();
    return users.map((user) => toIdentityUserListItem(user, 'Active'));
  }

  async hasPermission(roleId: string, permissionName: string): Promise<boolean> {
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
      relations: ['permissions'],
    });
    return Boolean(
      role?.permissions.some(
        (permission) => permission.name === permissionName && permission.isActive,
      ),
    );
  }

  async getAdminRoleStatus(userId: string): Promise<{ roleName: DefaultRole }> {
    const user = await this.userRepository.findOne({ where: { id: userId }, relations: ['role'] });
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
    if (
      user.role?.name !== DefaultRole.ADMINISTRATOR &&
      user.role?.name !== DefaultRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException('Insufficient permissions.');
    }

    return { roleName: user.role.name };
  }

  private async requireRole(roleId: string, relations: string[] = []): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { id: roleId }, relations });
    if (!role) {
      throw new NotFoundException(`Role with id ${roleId} not found`);
    }
    return role;
  }

  private async countUsers(roleId: string): Promise<number> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.role_id = :roleId', { roleId })
      .getCount();
  }
}
