import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RestaurantStatus, type Restaurant } from 'src/entities/restaurant.entity';

type RestaurantWithDistance = Restaurant & {
  distance?: number | null;
  deliveryTime?: number | null;
};

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
  static fromRestaurant(restaurant: RestaurantWithDistance): RestaurantResponseDto {
    const address = restaurant.address;
    return {
      id: restaurant.id,
      name: restaurant.name ?? null,
      phoneNumber: restaurant.phoneNumber ?? null,
      avatar: restaurant.avatar ?? null,
      backgroundImage: restaurant.backgroundImage ?? null,
      description: restaurant.description ?? null,
      openTime: restaurant.openTime ?? null,
      closeTime: restaurant.closeTime ?? null,
      rating: restaurant.rating == null ? null : Number(restaurant.rating),
      status: restaurant.status,
      ownerId: restaurant.owner?.id ?? null,
      address: address
        ? {
            id: address.id,
            street: address.street ?? null,
            ward: address.ward ?? null,
            district: address.district ?? null,
            city: address.city ?? null,
            latitude: address.latitude == null ? null : Number(address.latitude),
            longitude: address.longitude == null ? null : Number(address.longitude),
          }
        : null,
      distance: restaurant.distance ?? null,
      deliveryTime: restaurant.deliveryTime ?? null,
    };
  }

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
