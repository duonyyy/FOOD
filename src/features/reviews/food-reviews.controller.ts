import { Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ReviewService } from './review.service';

@ApiTags('reviews')
@Controller('foods')
export class FoodReviewsController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get(':foodId/reviews')
  @ApiOperation({ summary: 'List paginated public reviews for a food item' })
  @ApiParam({ name: 'foodId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Paginated food review result' })
  getReviewsByFood(
    @Param('foodId') foodId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('sortBy', new DefaultValuePipe('createdAt')) sortBy: string,
    @Query('sortOrder', new DefaultValuePipe('DESC')) sortOrder: 'ASC' | 'DESC',
    @Query('minRating') minRating?: number,
    @Query('maxRating') maxRating?: number,
  ) {
    return this.reviewService.getReviewsByFood(
      foodId,
      page,
      pageSize,
      sortBy,
      sortOrder,
      minRating === undefined ? undefined : Number(minRating),
      maxRating === undefined ? undefined : Number(maxRating),
    );
  }
}
