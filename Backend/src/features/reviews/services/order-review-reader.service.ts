import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Review, ReviewType } from 'src/entities/review.entity';
import { In, Repository } from 'typeorm';
import {
  type OrderReviewReaderPort,
  type OrderReviewSummary,
  type OrderReviewSummaryRequest,
} from '../contracts/order-review-reader.port';

/** Read-only review projection consumed by Orders when rendering an order. */
@Injectable()
export class OrderReviewReaderService implements OrderReviewReaderPort {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
  ) {}

  async findOrderReviewSummary(request: OrderReviewSummaryRequest): Promise<OrderReviewSummary> {
    const foodReviews =
      request.foodIds.length === 0
        ? []
        : await this.reviewRepository.find({
            where: {
              user: { id: request.customerId },
              food: { id: In([...request.foodIds]) },
              type: ReviewType.FOOD,
            },
            relations: ['food'],
          });
    const shipperReview = request.shipperId
      ? await this.reviewRepository.findOne({
          where: {
            user: { id: request.customerId },
            shipper: { id: request.shipperId },
            type: ReviewType.SHIPPER,
          },
        })
      : null;

    return {
      foodReviews: foodReviews.map((review) => ({
        id: review.id,
        foodId: review.food.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
      })),
      shipperReview: shipperReview
        ? {
            id: shipperReview.id,
            rating: shipperReview.rating,
            comment: shipperReview.comment,
            createdAt: shipperReview.createdAt,
          }
        : null,
    };
  }
}
