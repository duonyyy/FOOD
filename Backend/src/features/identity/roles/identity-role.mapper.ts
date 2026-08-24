import { Permission } from 'src/entities/permission.entity';
import { Role } from 'src/entities/role.entity';
import { toIdentityUserListItem } from '../users/identity-user.mapper';
import {
  IdentityPermissionResponseDto,
  IdentityRoleDetailResponseDto,
  IdentityRoleResponseDto,
} from './dto/identity-role-response.dto';

export function toIdentityPermissionResponse(
  permission: Permission,
): IdentityPermissionResponseDto {
  return {
    id: permission.id,
    name: permission.name,
    description: permission.description ?? null,
    isActive: Boolean(permission.isActive),
  };
}

export function toIdentityRoleResponse(role: Role, userCount: number): IdentityRoleResponseDto {
  return {
    id: role.id,
    name: role.name,
    displayName: role.displayName ?? null,
    description: role.description ?? null,
    isSystem: Boolean(role.isSystem),
    createdAt: role.createdAt ?? null,
    updatedAt: role.updatedAt ?? null,
    userCount,
  };
}

export function toIdentityRoleDetailResponse(
  role: Role,
  userCount: number,
): IdentityRoleDetailResponseDto {
  return {
    ...toIdentityRoleResponse(role, userCount),
    permissions: (role.permissions ?? []).map(toIdentityPermissionResponse),
    users: (role.users ?? []).map((user) => toIdentityUserListItem(user, 'Active')),
  };
}
