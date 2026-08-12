import { Review } from 'src/entities/review.entity';
import { ReviewResponseDto } from './dto/review-response.dto';

export function toReviewResponse(review: Review): ReviewResponseDto {
  return {
    id: review.id,
    orderId: review.orderId ?? null,
    type: review.type,
    rating: review.rating ?? null,
    comment: review.comment ?? null,
    image: review.image ?? null,
    foodId: review.food?.id ?? null,
    shipperId: review.shipper?.id ?? null,
    author: {
      id: review.user?.id ?? '',
      name: review.user?.name ?? null,
      avatar: review.user?.avatar ?? null,
    },
    createdAt: review.createdAt,
  };
}
