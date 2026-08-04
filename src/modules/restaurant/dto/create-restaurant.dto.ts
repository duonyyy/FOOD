import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { RestaurantStatus } from 'src/entities/restaurant.entity';

export class CreateRestaurantDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  backgroundImage?: string;

  // Full address string (when provided as a single value)
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  // Individual address components (when provided separately)
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  addressStreet?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  addressWard?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  addressDistrict?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  addressCity?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  openTime?: string;

  @IsString()
  @IsOptional()
  closeTime?: string;

  @IsString()
  @IsOptional()
  licenseCode?: string;

  @IsString()
  @IsOptional()
  certificateImage?: string;

  @ApiPropertyOptional({ enum: RestaurantStatus })
  @IsEnum(RestaurantStatus)
  @IsOptional()
  status?: RestaurantStatus;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ownerId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  latitude?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  longitude?: string;
}
