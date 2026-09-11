import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IdentityRoleSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  displayName: string | null;
}

export class IdentityAddressSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  street: string;

  @ApiPropertyOptional({ nullable: true })
  ward: string | null;

  @ApiPropertyOptional({ nullable: true })
  district: string | null;

  @ApiProperty()
  city: string;

  @ApiPropertyOptional({ nullable: true })
  label: string | null;

  @ApiProperty({ default: false })
  isDefault: boolean;
}

export class IdentityUserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiPropertyOptional({ nullable: true })
  email: string | null;

  @ApiPropertyOptional({ nullable: true })
  name: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ nullable: true })
  avatar: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  birthday: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  createdAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  lastLoginAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  authProvider: string | null;

  @ApiPropertyOptional({ type: () => IdentityRoleSummaryDto, nullable: true })
  role: IdentityRoleSummaryDto | null;

  @ApiProperty({ type: () => [IdentityAddressSummaryDto] })
  addresses: IdentityAddressSummaryDto[];
}

export class IdentityUserListItemDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ nullable: true })
  name: string | null;

  @ApiPropertyOptional({ nullable: true })
  email: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  createdAt: string | null;

  @ApiProperty()
  status: string;
}
