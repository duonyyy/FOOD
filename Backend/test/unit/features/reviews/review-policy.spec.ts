import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ReviewsController } from 'src/features/reviews/controllers/customer-reviews.controller';
import { AuthGuard } from 'src/features/users/public-api';

describe('Review authorization policy', () => {
  it.each(['createFoodReview', 'createShipperReview', 'updateReview', 'deleteReview'])(
    'requires authentication for %s',
    (methodName) => {
      const method = Object.getOwnPropertyDescriptor(ReviewsController.prototype, methodName)
        ?.value as unknown;
      const guards = Reflect.getMetadata(GUARDS_METADATA, method as object) as unknown[];

      expect(guards).toContain(AuthGuard);
    },
  );
});
