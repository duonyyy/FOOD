import { ApiProperty } from '@nestjs/swagger';

export class NotificationResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Notification ID' })
  id: string;

  @ApiProperty({ description: 'Short notification label', example: 'Cập nhật trạng thái đơn hàng' })
  description: string;

  @ApiProperty({
    description: 'Full notification message',
    example: 'Đơn hàng của bạn đã chuyển sang trạng thái: confirmed',
  })
  content: string;

  @ApiProperty({ description: 'Notification type discriminator', example: 'order' })
  type: string;

  @ApiProperty({ description: 'Whether the notification has been read' })
  isRead: boolean;

  @ApiProperty({
    description: 'When the notification was created',
    type: String,
    format: 'date-time',
  })
  createdAt: Date;
}
