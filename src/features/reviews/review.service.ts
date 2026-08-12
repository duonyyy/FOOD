import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Review, ReviewType } from 'src/entities/review.entity';
import {
  FOOD_REVIEW_TARGET_READER,
  type FoodReviewTargetReaderPort,
} from 'src/features/menu/public-api';
import {
  ORDER_REVIEW_ELIGIBILITY_READER,
  type OrderReviewEligibilityReaderPort,
  type OrderReviewEligibilitySnapshot,
} from 'src/features/orders/public-api';
import { Repository } from 'typeorm';
import {
  CreateFoodReviewDto,
  CreateShipperReviewDto,
  UpdateReviewDto,
} from './dto/create-review.dto';
import { ReviewResponseDto } from './dto/review-response.dto';
import { toReviewResponse } from './review.mapper';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @Inject(ORDER_REVIEW_ELIGIBILITY_READER)
    private readonly orderReviewEligibilityReader: OrderReviewEligibilityReaderPort,
    @Inject(FOOD_REVIEW_TARGET_READER)
    private readonly foodReviewTargetReader: FoodReviewTargetReaderPort,
  ) {}

  async createFoodReview(
    createReviewDto: CreateFoodReviewDto,
    actorUserId: string,
  ): Promise<ReviewResponseDto> {
    const order = await this.requireCompletedCustomerOrder(createReviewDto.orderId, actorUserId);
    if (!order.foodIds.includes(createReviewDto.foodId)) {
      throw new ForbiddenException('The reviewed food was not purchased in this order');
    }

    const food = await this.foodReviewTargetReader.findFoodReviewTarget(createReviewDto.foodId);
    if (!food) {
      throw new NotFoundException(`Food with id ${createReviewDto.foodId} not found`);
    }

    await this.rejectDuplicate({
      orderId: createReviewDto.orderId,
      actorUserId,
      type: ReviewType.FOOD,
      targetId: createReviewDto.foodId,
    });

    return this.saveReview({
      orderId: createReviewDto.orderId,
      actorUserId,
      type: ReviewType.FOOD,
      targetId: createReviewDto.foodId,
      rating: createReviewDto.rating,
      comment: createReviewDto.comment.trim(),
      image: createReviewDto.image?.trim() || null,
    });
  }

  async createShipperReview(
    createReviewDto: CreateShipperReviewDto,
    actorUserId: string,
  ): Promise<ReviewResponseDto> {
    const order = await this.requireCompletedCustomerOrder(createReviewDto.orderId, actorUserId);
    if (!order.shipperId || order.shipperId !== createReviewDto.shipperId) {
      throw new ForbiddenException('The reviewed shipper did not deliver this order');
    }

    await this.rejectDuplicate({
      orderId: createReviewDto.orderId,
      actorUserId,
      type: ReviewType.SHIPPER,
      targetId: createReviewDto.shipperId,
    });

    return this.saveReview({
      orderId: createReviewDto.orderId,
      actorUserId,
      type: ReviewType.SHIPPER,
      targetId: createReviewDto.shipperId,
      rating: createReviewDto.rating,
      comment: createReviewDto.comment.trim(),
      image: null,
    });
  }

  async getReviewsForFood(foodId: string): Promise<ReviewResponseDto[]> {
    const reviews = await this.reviewRepository.find({
      where: { food: { id: foodId }, type: ReviewType.FOOD },
      relations: ['user', 'food'],
      order: { createdAt: 'DESC' },
    });
    return reviews.map(toReviewResponse);
  }

  async getReviewsForShipper(shipperId: string): Promise<ReviewResponseDto[]> {
    const reviews = await this.reviewRepository.find({
      where: { shipper: { id: shipperId }, type: ReviewType.SHIPPER },
      relations: ['user', 'shipper'],
      order: { createdAt: 'DESC' },
    });
    return reviews.map(toReviewResponse);
  }

  async updateReview(
    reviewId: string,
    actorUserId: string,
    updateReviewDto: UpdateReviewDto,
  ): Promise<ReviewResponseDto> {
    const review = await this.requireOwnedReview(reviewId, actorUserId);
    review.rating = updateReviewDto.rating;
    review.comment = updateReviewDto.comment.trim();
    if (updateReviewDto.image !== undefined && review.type === ReviewType.FOOD) {
      review.image = updateReviewDto.image.trim();
    }

    return toReviewResponse(await this.reviewRepository.save(review));
  }

  async deleteReview(reviewId: string, actorUserId: string): Promise<void> {
    await this.requireOwnedReview(reviewId, actorUserId);
    await this.reviewRepository.delete(reviewId);
  }

  private async requireCompletedCustomerOrder(
    orderId: string,
    actorUserId: string,
  ): Promise<OrderReviewEligibilitySnapshot> {
    const order = await this.orderReviewEligibilityReader.findReviewEligibility({
      orderId,
      customerId: actorUserId,
    });
    if (!order) {
      throw new ForbiddenException('This order is not available for review by the current user');
    }
    if (order.orderStatus !== 'completed') {
      throw new ConflictException('Reviews are available only after the order is completed');
    }
    return order;
  }

  private async rejectDuplicate(input: {
    orderId: string;
    actorUserId: string;
    type: ReviewType;
    targetId: string;
  }): Promise<void> {
    const where =
      input.type === ReviewType.FOOD
        ? {
            orderId: input.orderId,
            user: { id: input.actorUserId },
            food: { id: input.targetId },
            type: ReviewType.FOOD,
          }
        : {
            orderId: input.orderId,
            user: { id: input.actorUserId },
            shipper: { id: input.targetId },
            type: ReviewType.SHIPPER,
          };
    const existingReview = await this.reviewRepository.findOne({ where });
    if (existingReview) {
      throw new ConflictException('A review for this order target already exists');
    }
  }

  private async saveReview(input: {
    orderId: string;
    actorUserId: string;
    type: ReviewType;
    targetId: string;
    rating: number;
    comment: string;
    image: string | null;
  }): Promise<ReviewResponseDto> {
    const isFoodReview = input.type === ReviewType.FOOD;
    const review = this.reviewRepository.create({
      orderId: input.orderId,
      user: { id: input.actorUserId },
      food: isFoodReview ? { id: input.targetId } : undefined,
      shipper: isFoodReview ? undefined : { id: input.targetId },
      type: input.type,
      rating: input.rating,
      comment: input.comment,
      image: input.image ?? undefined,
    });

    try {
      return toReviewResponse(await this.reviewRepository.save(review));
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException('A review for this order target already exists');
      }
      throw error;
    }
  }

  private async requireOwnedReview(reviewId: string, actorUserId: string): Promise<Review> {
    const review = await this.reviewRepository.findOne({
      where: { id: reviewId },
      relations: ['user', 'food', 'shipper'],
    });
    if (!review) {
      throw new NotFoundException(`Review with id ${reviewId} not found`);
    }
    if (review.user?.id !== actorUserId) {
      throw new ForbiddenException('Only the review author can change this review');
    }
    return review;
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
