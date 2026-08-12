import { ApiProperty } from '@nestjs/swagger';
import { NotificationResponseDto } from './notification-response.dto';

export class NotificationListResponseDto {
  @ApiProperty({ type: () => [NotificationResponseDto] })
  data: NotificationResponseDto[];

  @ApiProperty({ minimum: 0 })
  total: number;
}
