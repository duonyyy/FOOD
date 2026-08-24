import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ApproveRestaurantDto {
  @ApiPropertyOptional({
    description: 'Ghi chú nội bộ cho quyết định duyệt',
    example: 'Hồ sơ và giấy phép hợp lệ',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  note?: string;
}

export class RejectRestaurantDto {
  @ApiPropertyOptional({
    description: 'Lý do từ chối, được ghi vào audit log',
    example: 'Giấy phép kinh doanh chưa hợp lệ',
    maxLength: 500,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
