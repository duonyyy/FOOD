import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class ProcessPaymentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  token?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cardNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expiryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cvv?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankCode?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class PaymentWebhookDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  partnerCode: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  requestId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resultCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderInfo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  responseTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  extraData?: string;

  @IsOptional()
  @IsString()
  signature?: string;
}

export class MomoResultQueryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ enum: ['0', '9000', '1000', '1001', '1002', '1003', '1004', '1005', '1006'] })
  @IsString()
  @IsIn(['0', '9000', '1000', '1001', '1002', '1003', '1004', '1005', '1006'])
  resultCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;
}

export class PaymentOrderIdDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  orderId: string;
}
