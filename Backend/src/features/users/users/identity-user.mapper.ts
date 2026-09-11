import * as moment from 'moment';
import { User } from 'src/entities/user.entity';
import {
  IdentityRoleSummaryDto,
  IdentityUserListItemDto,
  IdentityUserResponseDto,
} from './dto/identity-user-response.dto';

export function toIdentityUserResponse(user: User): IdentityUserResponseDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email ?? null,
    name: user.name ?? null,
    phone: user.phone ?? null,
    avatar: user.avatar ?? null,
    isActive: Boolean(user.isActive),
    birthday: user.birthday ?? null,
    createdAt: user.createdAt ?? null,
    lastLoginAt: user.lastLoginAt ?? null,
    authProvider: user.authProvider ?? null,
    role: toIdentityRoleSummary(user),
    addresses: (user.address ?? [])
      .filter((address) => !address.isTemporary)
      .map((address) => ({
        id: address.id,
        street: address.street,
        ward: address.ward ?? null,
        district: address.district ?? null,
        city: address.city,
        label: address.label ?? null,
        isDefault: Boolean(address.isDefault),
      })),
  };
}

export function toIdentityUserListItem(
  user: Pick<User, 'id' | 'name' | 'email' | 'createdAt' | 'lastLoginAt'>,
  status: string,
): IdentityUserListItemDto {
  return {
    id: user.id,
    name: user.name ?? null,
    email: user.email ?? null,
    createdAt: user.createdAt ? moment(user.createdAt).format('DD-MM-YYYY') : null,
    status,
  };
}

export function toIdentityRoleSummary(user: User): IdentityRoleSummaryDto | null {
  return user.role
    ? {
        id: user.role.id,
        name: user.role.name,
        displayName: user.role.displayName ?? null,
      }
    : null;
}
