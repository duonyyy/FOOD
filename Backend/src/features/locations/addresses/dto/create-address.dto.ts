import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAddressDto {
  /** Legacy fields remain accepted for mobile-client compatibility; ownership is server-derived. */
  @ApiPropertyOptional({ readOnly: true, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: '1 Nguyễn Huệ' })
  @IsString()
  street: string;

  @ApiPropertyOptional({ example: 'Bến Nghé' })
  @IsOptional()
  @IsString()
  ward?: string;

  @ApiPropertyOptional({ example: 'Quận 1' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty({ example: 'Hồ Chí Minh' })
  @IsString()
  city: string;

  @ApiPropertyOptional({ example: 10.7769, nullable: true })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 106.7009, nullable: true })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: 'Nhà riêng' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ readOnly: true, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
