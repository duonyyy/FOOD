import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Review, ReviewType } from 'src/entities/review.entity';
import { FoodIntegrationService } from 'src/features/menu/public-api';
import { OrderRulesService } from 'src/features/orders/public-api';
import { In, Repository } from 'typeorm';
import {
  CreateFoodReviewDto,
  CreateShipperReviewDto,
  UpdateReviewDto,
} from '../dto/create-review.dto';
import { ReviewResponseDto } from '../dto/review-response.dto';
import { toReviewResponse } from '../mappers/review.mapper';
import type { OrderReviewInfo } from '../types/order-review.types';

@Injectable()
export class CustomerReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    private readonly orderRules: OrderRulesService,
    private readonly foodReviewTargetReader: FoodIntegrationService,
  ) {}

  async createFoodReview(
    createReviewDto: CreateFoodReviewDto,
    actorUserId: string,
  ): Promise<ReviewResponseDto> {
    await this.orderRules.assertCustomerCanReviewFood({
      orderId: createReviewDto.orderId,
      customerId: actorUserId,
      foodId: createReviewDto.foodId,
    });
    await this.foodReviewTargetReader.assertFoodExists(createReviewDto.foodId);

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
    await this.orderRules.assertCustomerCanReviewShipper({
      orderId: createReviewDto.orderId,
      customerId: actorUserId,
      shipperId: createReviewDto.shipperId,
    });

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

  async getOrderReviewInfo(
    orderId: string,
    actorUserId: string,
    actorRole?: string,
  ): Promise<OrderReviewInfo> {
    const context = await this.orderRules.getOrderReviewContext({
      orderId,
      actorId: actorUserId,
      actorRole,
    });
    const foodReviews =
      context.foodIds.length === 0
        ? []
        : await this.reviewRepository.find({
            where: {
              orderId,
              user: { id: context.customerId },
              food: { id: In(context.foodIds) },
              type: ReviewType.FOOD,
            },
            relations: ['food'],
          });
    const shipperReview = context.shipperId
      ? await this.reviewRepository.findOne({
          where: {
            orderId,
            user: { id: context.customerId },
            shipper: { id: context.shipperId },
            type: ReviewType.SHIPPER,
          },
        })
      : null;
    const mappedFoodReviews = foodReviews.map((review) => ({
      id: review.id,
      foodId: review.food.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
    }));
    const mappedShipperReview = shipperReview
      ? {
          id: shipperReview.id,
          rating: shipperReview.rating,
          comment: shipperReview.comment,
          createdAt: shipperReview.createdAt,
        }
      : null;

    return {
      hasReviewedFood: mappedFoodReviews.length > 0,
      hasReviewedShipper: Boolean(mappedShipperReview),
      foodReviews: mappedFoodReviews,
      shipperReview: mappedShipperReview,
      canReviewFood: context.status === 'completed' && mappedFoodReviews.length === 0,
      canReviewShipper:
        context.status === 'completed' && Boolean(context.shipperId && !mappedShipperReview),
    };
  }

  async getReviewsForFood(foodId: string): Promise<ReviewResponseDto[]> {
    const reviews = await this.reviewRepository.find({
      where: { food: { id: foodId }, type: ReviewType.FOOD },
      relations: ['user', 'food'],
      order: { createdAt: 'DESC' },
    });
    return reviews.map(toReviewResponse);
  }

  async getReviewsByFood(
    foodId: string,
    page = 1,
    pageSize = 10,
    sortBy = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
    minRating?: number,
    maxRating?: number,
  ) {
    await this.foodReviewTargetReader.assertFoodExists(foodId);

    const query = this.reviewRepository
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.user', 'user')
      .where('review.food_id = :foodId', { foodId })
      .andWhere('review.type = :type', { type: ReviewType.FOOD });
    if (minRating !== undefined) query.andWhere('review.rating >= :minRating', { minRating });
    if (maxRating !== undefined) query.andWhere('review.rating <= :maxRating', { maxRating });

    const safeSort = ['rating', 'createdAt'].includes(sortBy) ? sortBy : 'createdAt';
    query.orderBy(`review.${safeSort}`, sortOrder === 'ASC' ? 'ASC' : 'DESC');
    const totalItems = await query.getCount();
    const items = await query
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();
    const stats = await this.reviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'average')
      .addSelect('review.rating', 'rating')
      .addSelect('COUNT(*)', 'count')
      .where('review.food_id = :foodId', { foodId })
      .andWhere('review.type = :type', { type: ReviewType.FOOD })
      .andWhere('review.rating IS NOT NULL')
      .groupBy('review.rating')
      .getRawMany<{ rating: string; count: string }>();
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of stats) ratingDistribution[Number(row.rating)] = Number(row.count);
    const averageRating = stats.length
      ? Number(
          (
            stats.reduce((sum, row) => sum + Number(row.rating) * Number(row.count), 0) /
            stats.reduce((sum, row) => sum + Number(row.count), 0)
          ).toFixed(1),
        )
      : null;

    return {
      items: items.map(toReviewResponse),
      totalItems,
      page,
      pageSize,
      totalPages: Math.ceil(totalItems / pageSize),
      averageRating,
      ratingDistribution,
    };
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

/** Backward compatibility alias */
export const ReviewService = CustomerReviewsService;
export type ReviewService = CustomerReviewsService;
