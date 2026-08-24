import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RestaurantStatus } from 'src/entities/restaurant.entity';

export class RestaurantAddressResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional()
  street: string | null;

  @ApiPropertyOptional()
  ward: string | null;

  @ApiPropertyOptional()
  district: string | null;

  @ApiPropertyOptional()
  city: string | null;

  @ApiPropertyOptional({ type: Number })
  latitude: number | null;

  @ApiPropertyOptional({ type: Number })
  longitude: number | null;
}

export class RestaurantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string | null;

  @ApiPropertyOptional()
  phoneNumber: string | null;

  @ApiPropertyOptional()
  avatar: string | null;

  @ApiPropertyOptional()
  backgroundImage: string | null;

  @ApiPropertyOptional()
  description: string | null;

  @ApiPropertyOptional()
  openTime: string | null;

  @ApiPropertyOptional()
  closeTime: string | null;

  @ApiPropertyOptional({ type: Number })
  rating: number | null;

  @ApiProperty({ enum: RestaurantStatus })
  status: RestaurantStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  ownerId: string | null;

  @ApiPropertyOptional({ type: RestaurantAddressResponseDto })
  address: RestaurantAddressResponseDto | null;

  @ApiPropertyOptional({ type: Number })
  distance: number | null;

  @ApiPropertyOptional({ type: Number })
  deliveryTime: number | null;
}

export class RestaurantPageResponseDto {
  @ApiProperty({ type: [RestaurantResponseDto] })
  items: RestaurantResponseDto[];

  @ApiProperty()
  totalItems: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  totalPages: number;
}
