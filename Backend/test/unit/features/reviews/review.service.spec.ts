import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ReviewType } from 'src/entities/review.entity';
import { FoodIntegrationService } from 'src/features/menu/public-api';
import { OrderReviewEligibilityService } from 'src/features/orders/order-review-eligibility.public-api';
import { ReviewService } from 'src/features/reviews/services/customer-reviews.service';

const completedOrder = {
  orderId: '00000000-0000-4000-8000-000000000001',
  foodId: '00000000-0000-4000-8000-000000000002',
  shipperId: 'shipper-1',
};

describe('ReviewService', () => {
  function createService(overrides?: {
    existingReview?: object | null;
    saveError?: Error;
    foodReviewError?: Error;
    shipperReviewError?: Error;
    foodExistsError?: Error;
  }) {
    const reviewRepository = {
      findOne: jest.fn().mockResolvedValue(overrides?.existingReview ?? null),
      create: jest.fn((review: Record<string, unknown>) => ({
        ...review,
        id: 'review-1',
        createdAt: new Date('2026-08-12T00:00:00.000Z'),
      })),
      save: jest.fn((review: Record<string, unknown>) => {
        if (overrides?.saveError) {
          return Promise.reject(overrides.saveError);
        }
        return Promise.resolve(review);
      }),
      find: jest.fn(),
      delete: jest.fn(),
    };
    const orderReviewEligibilityReader = {
      assertCustomerCanReviewFood: jest
        .fn()
        .mockImplementation(() =>
          overrides?.foodReviewError
            ? Promise.reject(overrides.foodReviewError)
            : Promise.resolve(),
        ),
      assertCustomerCanReviewShipper: jest
        .fn()
        .mockImplementation(() =>
          overrides?.shipperReviewError
            ? Promise.reject(overrides.shipperReviewError)
            : Promise.resolve(),
        ),
    };
    const foodReviewTargetReader = {
      assertFoodExists: jest
        .fn()
        .mockImplementation(() =>
          overrides?.foodExistsError
            ? Promise.reject(overrides.foodExistsError)
            : Promise.resolve(),
        ),
    };

    return {
      service: new ReviewService(
        reviewRepository as never,
        orderReviewEligibilityReader as unknown as OrderReviewEligibilityService,
        foodReviewTargetReader as unknown as FoodIntegrationService,
      ),
      reviewRepository,
      orderReviewEligibilityReader,
      foodReviewTargetReader,
    };
  }

  it('creates a food review only for a purchased food in the actor completed order', async () => {
    const { service, reviewRepository, orderReviewEligibilityReader, foodReviewTargetReader } =
      createService();

    const response = await service.createFoodReview(
      {
        orderId: completedOrder.orderId,
        foodId: completedOrder.foodId,
        rating: 5,
        comment: ' Ngon ',
      },
      'customer-1',
    );

    expect(orderReviewEligibilityReader.assertCustomerCanReviewFood).toHaveBeenCalledWith({
      orderId: completedOrder.orderId,
      customerId: 'customer-1',
      foodId: completedOrder.foodId,
    });
    expect(foodReviewTargetReader.assertFoodExists).toHaveBeenCalledWith(completedOrder.foodId);
    expect(reviewRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: completedOrder.orderId,
        type: ReviewType.FOOD,
        food: { id: completedOrder.foodId },
        shipper: undefined,
      }),
    );
    expect(response).toMatchObject({ type: 'food', foodId: completedOrder.foodId });
  });

  it('creates a shipper review only for the shipper assigned to the completed order', async () => {
    const { service, reviewRepository, foodReviewTargetReader, orderReviewEligibilityReader } =
      createService();

    const response = await service.createShipperReview(
      {
        orderId: completedOrder.orderId,
        shipperId: 'shipper-1',
        rating: 4,
        comment: 'Giao nhanh',
      },
      'customer-1',
    );

    expect(reviewRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ReviewType.SHIPPER,
        food: undefined,
        shipper: { id: 'shipper-1' },
      }),
    );
    expect(orderReviewEligibilityReader.assertCustomerCanReviewShipper).toHaveBeenCalledWith({
      orderId: completedOrder.orderId,
      customerId: 'customer-1',
      shipperId: completedOrder.shipperId,
    });
    expect(foodReviewTargetReader.assertFoodExists).not.toHaveBeenCalled();
    expect(response).toMatchObject({ type: 'shipper', shipperId: 'shipper-1' });
  });

  it('rejects a food target that is not in the completed order', async () => {
    const { service } = createService({
      foodReviewError: new ForbiddenException('The reviewed food was not purchased in this order'),
    });

    await expect(
      service.createFoodReview(
        {
          orderId: completedOrder.orderId,
          foodId: '00000000-0000-4000-8000-000000000099',
          rating: 5,
          comment: 'Sai món',
        },
        'customer-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects review creation before the order is completed', async () => {
    const { service } = createService({
      shipperReviewError: new ConflictException(
        'Reviews are available only after the order is completed',
      ),
    });

    await expect(
      service.createShipperReview(
        {
          orderId: completedOrder.orderId,
          shipperId: 'shipper-1',
          rating: 5,
          comment: 'Chưa xong',
        },
        'customer-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a duplicate review before writing', async () => {
    const { service, reviewRepository } = createService({
      existingReview: { id: 'existing-review' },
    });

    await expect(
      service.createFoodReview(
        {
          orderId: completedOrder.orderId,
          foodId: completedOrder.foodId,
          rating: 5,
          comment: 'Trùng',
        },
        'customer-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(reviewRepository.save).not.toHaveBeenCalled();
  });

  it('translates the database duplicate constraint to a conflict response', async () => {
    const duplicateError = Object.assign(new Error('duplicate review'), { code: '23505' });
    const { service } = createService({ saveError: duplicateError });

    await expect(
      service.createShipperReview(
        {
          orderId: completedOrder.orderId,
          shipperId: 'shipper-1',
          rating: 5,
          comment: 'Concurrent request',
        },
        'customer-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
