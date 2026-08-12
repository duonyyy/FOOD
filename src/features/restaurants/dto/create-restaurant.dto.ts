import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { RestaurantStatus } from 'src/entities/restaurant.entity';

export class CreateRestaurantDto {
  @ApiProperty({ example: 'Bún chả Phố Cổ' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(30)
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
  @MaxLength(2_000)
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

  /**
   * Used only by admin/backoffice compatibility commands. Merchant onboarding
   * takes the owner from the authenticated actor instead.
   */
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ownerId: string;

  @ApiPropertyOptional({ example: '10.7769' })
  @IsNumberString()
  @IsOptional()
  latitude?: string;

  @ApiPropertyOptional({ example: '106.7009' })
  @IsNumberString()
  @IsOptional()
  longitude?: string;
}
