import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CalculateOrderItemDto } from './calculate-order.dto';

export class ValidatePromotionDto {
  @ApiProperty({ description: 'Mã khuyến mãi cần kiểm tra', example: 'GIAM20K' })
  @IsNotEmpty({ message: 'Mã khuyến mãi không được để trống' })
  @IsString()
  promotionCode: string;

  @ApiProperty({ description: 'ID của địa chỉ giao hàng' })
  @IsUUID(undefined, { message: 'addressId phải là UUID hợp lệ' })
  addressId: string;

  @ApiProperty({ description: 'ID của nhà hàng' })
  @IsUUID(undefined, { message: 'restaurantId phải là UUID hợp lệ' })
  restaurantId: string;

  @ApiProperty({ type: [CalculateOrderItemDto], description: 'Danh sách món ăn' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Danh sách món không được để trống' })
  @ValidateNested({ each: true })
  @Type(() => CalculateOrderItemDto)
  items: CalculateOrderItemDto[];
}
