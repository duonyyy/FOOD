/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-argument */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthGuard } from 'src/features/identity/public-api';
import { ReviewService } from 'src/features/reviews/review.service';
import { ReviewsController } from 'src/features/reviews/reviews.controller';
import request = require('supertest');

describe('Reviews policy (e2e)', () => {
  let app: INestApplication;
  const reviewService = {
    createFoodReview: jest.fn().mockResolvedValue({ id: 'food-review-1', type: 'food' }),
    createShipperReview: jest.fn().mockResolvedValue({ id: 'shipper-review-1', type: 'shipper' }),
    getReviewsForFood: jest.fn(),
    getReviewsForShipper: jest.fn(),
    updateReview: jest.fn(),
    deleteReview: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [{ provide: ReviewService, useValue: reviewService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user: unknown } } }) => {
          context.switchToHttp().getRequest().user = { sub: 'customer-a' };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('uses the JWT actor when creating a food review', async () => {
    const body = {
      orderId: '00000000-0000-4000-8000-000000000001',
      foodId: '00000000-0000-4000-8000-000000000002',
      rating: 5,
      comment: 'Ngon',
    };

    await request(app.getHttpServer()).post('/reviews/food').send(body).expect(201);

    expect(reviewService.createFoodReview).toHaveBeenCalledWith(body, 'customer-a');
  });

  it('uses the JWT actor when creating a shipper review', async () => {
    const body = {
      orderId: '00000000-0000-4000-8000-000000000001',
      shipperId: 'shipper-a',
      rating: 4,
      comment: 'Nhanh',
    };

    await request(app.getHttpServer()).post('/reviews/shipper').send(body).expect(201);

    expect(reviewService.createShipperReview).toHaveBeenCalledWith(body, 'customer-a');
  });

  it('requires the JWT actor and returns 204 when deleting a review', async () => {
    const reviewId = '00000000-0000-4000-8000-000000000003';

    await request(app.getHttpServer()).delete(`/reviews/${reviewId}`).expect(204);

    expect(reviewService.deleteReview).toHaveBeenCalledWith(reviewId, 'customer-a');
  });
});
