import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ReviewType } from 'src/entities/review.entity';
import { ReviewService } from './review.service';

const completedOrder = {
  orderId: '00000000-0000-4000-8000-000000000001',
  customerId: 'customer-1',
  orderStatus: 'completed',
  foodIds: ['00000000-0000-4000-8000-000000000002'],
  shipperId: 'shipper-1',
};

describe('ReviewService', () => {
  function createService(overrides?: {
    order?: Partial<typeof completedOrder> | null;
    existingReview?: object | null;
    saveError?: Error;
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
      findReviewEligibility: jest
        .fn()
        .mockResolvedValue(
          overrides?.order === null ? null : { ...completedOrder, ...overrides?.order },
        ),
    };
    const foodReviewTargetReader = {
      findFoodReviewTarget: jest
        .fn()
        .mockResolvedValue({ foodId: completedOrder.foodIds[0], name: 'Bún bò' }),
    };

    return {
      service: new ReviewService(
        reviewRepository as never,
        orderReviewEligibilityReader,
        foodReviewTargetReader,
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
        foodId: completedOrder.foodIds[0],
        rating: 5,
        comment: ' Ngon ',
      },
      'customer-1',
    );

    expect(orderReviewEligibilityReader.findReviewEligibility).toHaveBeenCalledWith({
      orderId: completedOrder.orderId,
      customerId: 'customer-1',
    });
    expect(foodReviewTargetReader.findFoodReviewTarget).toHaveBeenCalledWith(
      completedOrder.foodIds[0],
    );
    expect(reviewRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: completedOrder.orderId,
        type: ReviewType.FOOD,
        food: { id: completedOrder.foodIds[0] },
        shipper: undefined,
      }),
    );
    expect(response).toMatchObject({ type: 'food', foodId: completedOrder.foodIds[0] });
  });

  it('creates a shipper review only for the shipper assigned to the completed order', async () => {
    const { service, reviewRepository, foodReviewTargetReader } = createService();

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
    expect(foodReviewTargetReader.findFoodReviewTarget).not.toHaveBeenCalled();
    expect(response).toMatchObject({ type: 'shipper', shipperId: 'shipper-1' });
  });

  it('rejects a food target that is not in the completed order', async () => {
    const { service } = createService();

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
    const { service } = createService({ order: { orderStatus: 'delivering' } });

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
          foodId: completedOrder.foodIds[0],
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
