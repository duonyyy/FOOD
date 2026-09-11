import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderAddressRequestDto } from './create-order-request.dto';

export class CalculateOrderToppingDto {
  @ApiProperty({ description: 'ID của topping' })
  @IsNotEmpty()
  @IsString()
  id: string;

  @ApiProperty({ description: 'Giá của topping', minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;
}

export class CalculateOrderItemDto {
  @ApiProperty({ description: 'ID của món ăn (UUID)' })
  @IsUUID(undefined, { message: 'foodId phải là UUID hợp lệ' })
  foodId: string;

  @ApiProperty({ description: 'Số lượng đặt', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Số lượng tối thiểu là 1' })
  quantity: number;

  @ApiPropertyOptional({ description: 'Phần trăm giảm giá (nếu có)', minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({
    type: [CalculateOrderToppingDto],
    description: 'Danh sách toppings đi kèm',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalculateOrderToppingDto)
  toppings?: CalculateOrderToppingDto[];
}

export class CalculateOrderDto {
  @ApiProperty({ description: 'ID của địa chỉ giao hàng đã lưu' })
  @IsUUID(undefined, { message: 'addressId phải là UUID hợp lệ' })
  addressId: string;

  @ApiProperty({ description: 'ID của nhà hàng' })
  @IsUUID(undefined, { message: 'restaurantId phải là UUID hợp lệ' })
  restaurantId: string;

  @ApiProperty({ type: [CalculateOrderItemDto], description: 'Danh sách món ăn cần tính giá' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Đơn hàng phải có ít nhất 1 món' })
  @ValidateNested({ each: true })
  @Type(() => CalculateOrderItemDto)
  items: CalculateOrderItemDto[];

  @ApiPropertyOptional({ description: 'Mã khuyến mãi (nếu có)' })
  @IsOptional()
  @IsString()
  promotionCode?: string;
}

export class CalculateOrderWithCustomAddressDto {
  @ApiProperty({ type: OrderAddressRequestDto, description: 'Địa chỉ tuỳ chỉnh để giao hàng' })
  @ValidateNested()
  @Type(() => OrderAddressRequestDto)
  address: OrderAddressRequestDto;

  @ApiProperty({ description: 'ID của nhà hàng' })
  @IsUUID(undefined, { message: 'restaurantId phải là UUID hợp lệ' })
  restaurantId: string;

  @ApiProperty({ type: [CalculateOrderItemDto], description: 'Danh sách món ăn cần tính giá' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Đơn hàng phải có ít nhất 1 món' })
  @ValidateNested({ each: true })
  @Type(() => CalculateOrderItemDto)
  items: CalculateOrderItemDto[];

  @ApiPropertyOptional({ description: 'Mã khuyến mãi (nếu có)' })
  @IsOptional()
  @IsString()
  promotionCode?: string;
}
