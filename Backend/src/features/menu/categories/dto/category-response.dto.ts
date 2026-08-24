import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryFoodResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ nullable: true })
  name: string | null;

  @ApiProperty({ nullable: true })
  image: string | null;

  @ApiPropertyOptional({ type: [String], nullable: true })
  imageUrls?: string[] | null;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ nullable: true })
  price: number | string | null;

  @ApiPropertyOptional({ nullable: true })
  discountPercent?: number | string | null;

  @ApiPropertyOptional({ nullable: true })
  status?: string | null;

  @ApiPropertyOptional({ nullable: true })
  tag?: string | null;

  @ApiPropertyOptional({ nullable: true })
  rating?: number | string | null;

  @ApiPropertyOptional({ nullable: true })
  preparationTime?: number | null;
}

export class CategoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ nullable: true })
  name: string | null;

  @ApiProperty({ nullable: true })
  image: string | null;

  @ApiProperty({ minimum: 0 })
  foodCount: number;

  @ApiPropertyOptional({ type: () => [CategoryFoodResponseDto] })
  foods?: CategoryFoodResponseDto[];
}

export class CategoryListResponseDto {
  @ApiProperty({ type: () => [CategoryResponseDto] })
  items: CategoryResponseDto[];

  @ApiProperty({ minimum: 0 })
  totalItems: number;

  @ApiProperty({ minimum: 1 })
  page: number;

  @ApiProperty({ minimum: 1 })
  pageSize: number;

  @ApiProperty({ minimum: 0 })
  totalPages: number;
}
