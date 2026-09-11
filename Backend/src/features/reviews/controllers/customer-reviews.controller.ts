import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard, CurrentActor, type CurrentActorData } from 'src/features/users/public-api';
import {
  CreateFoodReviewDto,
  CreateShipperReviewDto,
  UpdateReviewDto,
} from '../dto/create-review.dto';
import { ReviewResponseDto } from '../dto/review-response.dto';
import { CustomerReviewsService } from '../services/customer-reviews.service';

@ApiTags('reviews')
@Controller('reviews')
export class CustomerReviewsController {
  constructor(private readonly reviewService: CustomerReviewsService) {}

  @Post('food')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Review a food item from the current customer completed order' })
  @ApiResponse({ status: 201, type: ReviewResponseDto })
  @ApiResponse({
    status: 409,
    description: 'Order is incomplete or the target was already reviewed',
  })
  createFoodReview(
    @CurrentActor() actor: CurrentActorData,
    @Body() createReviewDto: CreateFoodReviewDto,
  ): Promise<ReviewResponseDto> {
    return this.reviewService.createFoodReview(createReviewDto, actor.userId);
  }

  @Post('shipper')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Review the shipper assigned to the current customer completed order' })
  @ApiResponse({ status: 201, type: ReviewResponseDto })
  @ApiResponse({
    status: 409,
    description: 'Order is incomplete or the target was already reviewed',
  })
  createShipperReview(
    @CurrentActor() actor: CurrentActorData,
    @Body() createReviewDto: CreateShipperReviewDto,
  ): Promise<ReviewResponseDto> {
    return this.reviewService.createShipperReview(createReviewDto, actor.userId);
  }

  @Get('food/:foodId')
  @ApiOperation({ summary: 'List public food reviews' })
  @ApiParam({ name: 'foodId', format: 'uuid' })
  @ApiResponse({ status: 200, type: [ReviewResponseDto] })
  getReviewsForFood(@Param('foodId', ParseUUIDPipe) foodId: string): Promise<ReviewResponseDto[]> {
    return this.reviewService.getReviewsForFood(foodId);
  }

  @Get('shipper/:shipperId')
  @ApiOperation({ summary: 'List public shipper reviews' })
  @ApiResponse({ status: 200, type: [ReviewResponseDto] })
  getReviewsForShipper(@Param('shipperId') shipperId: string): Promise<ReviewResponseDto[]> {
    return this.reviewService.getReviewsForShipper(shipperId);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update a review owned by the current user' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ReviewResponseDto })
  @ApiResponse({ status: 403, description: 'Current user is not the review author' })
  updateReview(
    @Param('id', ParseUUIDPipe) reviewId: string,
    @CurrentActor() actor: CurrentActorData,
    @Body() updateReviewDto: UpdateReviewDto,
  ): Promise<ReviewResponseDto> {
    return this.reviewService.updateReview(reviewId, actor.userId, updateReviewDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Delete a review owned by the current user' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Review deleted' })
  @ApiResponse({ status: 403, description: 'Current user is not the review author' })
  async deleteReview(
    @Param('id', ParseUUIDPipe) reviewId: string,
    @CurrentActor() actor: CurrentActorData,
  ): Promise<void> {
    await this.reviewService.deleteReview(reviewId, actor.userId);
  }
}

/** Backward compatibility alias */
export const ReviewsController = CustomerReviewsController;
export type ReviewsController = CustomerReviewsController;
