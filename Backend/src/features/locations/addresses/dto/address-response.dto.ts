import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddressResponseDto {
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
  latitude: number | null;

  @ApiPropertyOptional({ nullable: true })
  longitude: number | null;

  @ApiProperty({ default: false })
  isDefault: boolean;

  @ApiPropertyOptional({ nullable: true })
  label: string | null;

  @ApiProperty({ default: false })
  isTemporary: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  createdAt?: Date | null;
}
