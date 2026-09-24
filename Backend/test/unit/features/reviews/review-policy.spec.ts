import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthGuard } from 'src/features/auth/public-api';
import { ReviewsController } from 'src/features/reviews/controllers/customer-reviews.controller';

describe('Review authorization policy', () => {
  it.each([
    'createFoodReview',
    'createShipperReview',
    'getOrderReviewInfo',
    'updateReview',
    'deleteReview',
  ])('requires authentication for %s', (methodName) => {
    const method = Object.getOwnPropertyDescriptor(ReviewsController.prototype, methodName)
      ?.value as unknown;
    const guards = Reflect.getMetadata(GUARDS_METADATA, method as object) as unknown[];

    expect(guards).toContain(AuthGuard);
  });
});
