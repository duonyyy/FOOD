import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ApiProperty()
  @IsString()
  id?: string;

  @IsString()
  street: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ApiPropertyOptional()
  @IsString()
  ward?: string;

  @IsOptional()
  @ApiProperty()
  @IsString()
  district?: string;

  @IsString()
  city: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  userId: string;
}
