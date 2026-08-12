import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

class ReviewContentDto {
  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ maxLength: 1_000, example: 'Món ngon, giao đúng giờ.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1_000)
  comment: string;
}

export class CreateFoodReviewDto extends ReviewContentDto {
  @ApiProperty({ format: 'uuid', description: 'Completed order containing the food item' })
  @IsUUID()
  orderId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  foodId: string;

  @ApiPropertyOptional({ maxLength: 2_048, description: 'Review image URL' })
  @IsOptional()
  @IsString()
  @MaxLength(2_048)
  image?: string;
}

export class CreateShipperReviewDto extends ReviewContentDto {
  @ApiProperty({ format: 'uuid', description: 'Completed order delivered by this shipper' })
  @IsUUID()
  orderId: string;

  @ApiProperty({ description: 'Shipper user ID assigned to the order' })
  @IsString()
  @IsNotEmpty()
  shipperId: string;
}

export class UpdateReviewDto extends ReviewContentDto {
  @ApiPropertyOptional({ maxLength: 2_048, description: 'Review image URL' })
  @IsOptional()
  @IsString()
  @MaxLength(2_048)
  image?: string;
}
