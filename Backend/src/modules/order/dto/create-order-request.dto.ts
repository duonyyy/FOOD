import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class OrderAddressRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  street: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ward: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  district: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;
}

export class OrderToppingRequestDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  // Accepted for legacy clients but ignored by server-side pricing.
  @ApiPropertyOptional({ description: 'Legacy field; ignored for server-side pricing.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;
}

export class OrderItemRequestDto {
  @ApiProperty()
  @IsUUID()
  foodId: string;

  @ApiProperty({ description: 'Quantity is accepted as a numeric string for compatibility.' })
  @Transform(({ value }) => String(value))
  @IsNumberString({ no_symbols: true })
  quantity: string;

  // Accepted for backward compatibility; the database price is authoritative.
  @ApiPropertyOptional({ description: 'Legacy field; ignored for server-side pricing.' })
  @IsOptional()
  @Transform(({ value }) => String(value))
  @IsNumberString()
  price?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  discountPercent?: number;

  @ApiPropertyOptional({ type: () => [OrderToppingRequestDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderToppingRequestDto)
  selectedToppings?: OrderToppingRequestDto[];
}

export class CreateOrderRequestDto {
  @ApiProperty()
  @IsUUID()
  restaurantId: string;

  @ApiPropertyOptional()
  @ValidateIf((request: CreateOrderRequestDto) => !request.address)
  @IsUUID()
  addressId?: string;

  @ApiPropertyOptional({ type: () => OrderAddressRequestDto })
  @ValidateIf((request: CreateOrderRequestDto) => !request.addressId)
  @ValidateNested()
  @Type(() => OrderAddressRequestDto)
  address?: OrderAddressRequestDto;

  // Accepted for compatibility but ignored by server-side pricing.
  @ApiPropertyOptional({ description: 'Legacy field; ignored for server-side pricing.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  total?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  promotionCode?: string;

  @ApiPropertyOptional({ minimum: 30, maximum: 1440 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(1440)
  requestedDeliveryTime?: number;

  @ApiPropertyOptional({ enum: ['asap', 'scheduled'] })
  @IsOptional()
  @IsIn(['asap', 'scheduled'])
  deliveryType?: 'asap' | 'scheduled';

  @ApiProperty({ type: () => [OrderItemRequestDto] })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OrderItemRequestDto)
  orderDetails: OrderItemRequestDto[];
}
