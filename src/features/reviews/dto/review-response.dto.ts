import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewAuthorResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ nullable: true })
  name: string | null;

  @ApiPropertyOptional({ nullable: true })
  avatar: string | null;
}

export class ReviewResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  orderId: string | null;

  @ApiProperty({ enum: ['food', 'shipper'] })
  type: 'food' | 'shipper';

  @ApiProperty({ minimum: 1, maximum: 5 })
  rating: number | null;

  @ApiPropertyOptional({ nullable: true })
  comment: string | null;

  @ApiPropertyOptional({ nullable: true })
  image: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  foodId: string | null;

  @ApiPropertyOptional({ nullable: true })
  shipperId: string | null;

  @ApiProperty({ type: () => ReviewAuthorResponseDto })
  author: ReviewAuthorResponseDto;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}
