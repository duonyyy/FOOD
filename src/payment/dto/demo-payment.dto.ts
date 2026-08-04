import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateDemoOrderDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateDemoCheckoutDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiPropertyOptional({ enum: ['momo', 'vnpay'] })
  @IsOptional()
  @IsIn(['momo', 'vnpay'])
  paymentMethod?: 'momo' | 'vnpay';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ipAddress?: string;
}

export class DemoWebhookDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty()
  @IsString()
  resultCode: string;
}
