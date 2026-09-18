import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { OrderStatus } from 'src/shared/types/enums/order-status.enum';

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: OrderStatus,
    description: 'Trạng thái mới của đơn hàng',
    example: OrderStatus.CONFIRMED,
  })
  @IsNotEmpty({ message: 'Trạng thái không được để trống' })
  @IsEnum(OrderStatus, {
    message: `Trạng thái không hợp lệ. Các giá trị cho phép: ${Object.values(OrderStatus).join(', ')}`,
  })
  status: OrderStatus;
}
