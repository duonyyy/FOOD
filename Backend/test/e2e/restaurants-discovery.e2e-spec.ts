/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-argument */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PublicRestaurantsController } from 'src/features/menu/controllers/public-restaurants.controller';
import { FoodIntegrationService } from 'src/features/menu/public-api';
import { PublicRestaurantsService } from 'src/features/restaurants/public-api';
import request = require('supertest');

describe('Public restaurant discovery routes (e2e)', () => {
  let app: INestApplication;
  const restaurant = { id: 'restaurant-1', name: 'Quán thử nghiệm', status: 'approved' };
  const page = { items: [restaurant], totalItems: 1, page: 1, pageSize: 10, totalPages: 1 };
  const restaurants = {
    findAll: jest.fn().mockResolvedValue(page),
    getPreview: jest.fn().mockResolvedValue(page),
    getTopRestaurants: jest.fn().mockResolvedValue(page),
    findOne: jest.fn().mockResolvedValue(restaurant),
  };
  const foods = { listRestaurantFoodsCached: jest.fn().mockResolvedValue([{ foodId: 'food-1' }]) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PublicRestaurantsController],
      providers: [
        { provide: PublicRestaurantsService, useValue: restaurants },
        { provide: FoodIntegrationService, useValue: foods },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(async () => app?.close());
  beforeEach(() => jest.clearAllMocks());

  it('keeps /restaurants/popular ahead of the dynamic detail route', async () => {
    const response = await request(app.getHttpServer()).get('/restaurants/popular').expect(200);
    expect(restaurants.getTopRestaurants).toHaveBeenCalledWith(1, 3, undefined, undefined);
    expect(foods.listRestaurantFoodsCached).toHaveBeenCalledWith('restaurant-1', 1, 3);
    expect(response.body).toEqual({ items: [{ ...restaurant, foods: [{ foodId: 'food-1' }] }] });
    expect(restaurants.findOne).not.toHaveBeenCalled();
  });

  it('keeps the all, preview and detail routes', async () => {
    await request(app.getHttpServer()).get('/restaurants/all').expect(200);
    await request(app.getHttpServer()).get('/restaurants/preview').expect(200);
    await request(app.getHttpServer()).get('/restaurants/restaurant-1').expect(200);
    expect(restaurants.findAll).toHaveBeenCalledWith(1, 10, undefined, undefined);
    expect(restaurants.getPreview).toHaveBeenCalledWith(1, 10, undefined, undefined);
    expect(restaurants.findOne).toHaveBeenCalledWith('restaurant-1', undefined, undefined);
  });
});
