import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDate, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CreateAddressDto } from 'src/features/locations/public-api';

export class UpdateMeAddressDto extends OmitType(CreateAddressDto, ['id', 'userId'] as const) {}

export class UpdateMeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  birthday?: Date;

  // Legacy mobile payload uses `address`; keep it during compatibility phase.
  @ApiPropertyOptional({ type: () => [UpdateMeAddressDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateMeAddressDto)
  address?: UpdateMeAddressDto[];

  @ApiPropertyOptional({ type: () => [UpdateMeAddressDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateMeAddressDto)
  addresses?: UpdateMeAddressDto[];
}
