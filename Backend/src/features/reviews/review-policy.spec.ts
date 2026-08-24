import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthGuard } from 'src/features/identity/public-api';
import { ReviewsController } from './reviews.controller';

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
