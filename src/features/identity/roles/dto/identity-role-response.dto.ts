import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IdentityUserListItemDto } from '../../users/dto/identity-user-response.dto';

export class IdentityPermissionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty()
  isActive: boolean;
}

export class IdentityRoleResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  displayName: string | null;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty()
  isSystem: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  createdAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  updatedAt: Date | null;

  @ApiProperty({ minimum: 0 })
  userCount: number;
}

export class IdentityRoleDetailResponseDto extends IdentityRoleResponseDto {
  @ApiProperty({ type: () => [IdentityPermissionResponseDto] })
  permissions: IdentityPermissionResponseDto[];

  @ApiProperty({ type: () => [IdentityUserListItemDto] })
  users: IdentityUserListItemDto[];
}

export class IdentityRoleStatusResponseDto {
  @ApiProperty({ type: () => ({ name: String }) })
  role: { name: string };
}
