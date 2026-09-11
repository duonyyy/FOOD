import { NotFoundException } from '@nestjs/common';
import { CustomerFoodService } from 'src/features/menu/foods/services/customer-food.service';

type RecordedCondition = {
  condition: string;
  parameters?: Record<string, unknown>;
};

class RecordingFoodQueryBuilder {
  readonly conditions: RecordedCondition[] = [];

  leftJoinAndSelect(): this {
    return this;
  }

  leftJoin(): this {
    return this;
  }

  where(condition: string, parameters?: Record<string, unknown>): this {
    this.conditions.push({ condition, parameters });
    return this;
  }

  andWhere(condition: string, parameters?: Record<string, unknown>): this {
    this.conditions.push({ condition, parameters });
    return this;
  }

  orderBy(): this {
    return this;
  }

  addOrderBy(): this {
    return this;
  }

  skip(): this {
    return this;
  }

  take(): this {
    return this;
  }

  getManyAndCount(): Promise<[never[], number]> {
    return Promise.resolve([[], 0]);
  }

  getMany(): Promise<never[]> {
    return Promise.resolve([]);
  }

  getOne(): Promise<undefined> {
    return Promise.resolve(undefined);
  }
}

function expectPublicVisibility(queryBuilder: RecordingFoodQueryBuilder): void {
  expect(queryBuilder.conditions).toEqual(
    expect.arrayContaining([
      {
        condition: 'food.status = :publicFoodStatus',
        parameters: { publicFoodStatus: 'available' },
      },
      {
        condition: 'restaurant.status = :publicRestaurantStatus',
        parameters: { publicRestaurantStatus: 'approved' },
      },
    ]),
  );
}

describe('CustomerFoodService public menu visibility', () => {
  const queryBuilders: RecordingFoodQueryBuilder[] = [];
  const foodRepository = {
    createQueryBuilder: jest.fn(() => {
      const queryBuilder = new RecordingFoodQueryBuilder();
      queryBuilders.push(queryBuilder);
      return queryBuilder;
    }),
  };
  const categoryRepository = { findOne: jest.fn().mockResolvedValue({ id: 'category-a' }) };
  const merchantCatalog = {
    findRestaurant: jest.fn().mockResolvedValue({
      restaurantId: 'restaurant-a',
      name: 'Restaurant A',
      latitude: null,
      longitude: null,
    }),
  };
  const cache = {
    remember: jest.fn(<Value>(_key: string, _ttl: number, loader: () => Promise<Value>) => loader()),
    deleteByPattern: jest.fn(),
  };
  const service = new CustomerFoodService(
    foodRepository as never,
    categoryRepository as never,
    {} as never,
    merchantCatalog as never,
    cache as never,
    { getDistanceAndDuration: jest.fn() } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    queryBuilders.length = 0;
  });

  it('applies the same available-food and approved-restaurant predicate to every public path', async () => {
    await service.getTopFoodsByRestaurant('restaurant-a');
    await service.findAll();
    await service.findByRestaurantAndCategory('restaurant-a', 'category-a');
    await service.findByRestaurant('restaurant-a');
    await service.findByCategory('category-a');
    await service.findTopSelling();
    await service.findNewest();
    await service.findTopSellingByRestaurant('restaurant-a');
    await service.findByCategoryAndRestaurant('category-a', 'restaurant-a');
    await service.findWithDiscount();
    await service.findWithDiscountByRestaurant('restaurant-a');
    await service.searchFoods('burger');
    await service.findByName('burger');
    await expect(service.findOne('food-hidden')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getToppingsByFood('food-hidden')).rejects.toBeInstanceOf(NotFoundException);
    await service.findExactFoodByName('burger');
    await service.getMenuForUser('customer-a');

    expect(queryBuilders).toHaveLength(17);
    queryBuilders.forEach((queryBuilder) => expectPublicVisibility(queryBuilder));
  });

  it('does not reuse public visibility cache entries for privileged queries', async () => {
    await service.findAll(1, 10);
    await service.findAll(1, 10, undefined, undefined, undefined, undefined, 'admin');

    expect(cache.remember).toHaveBeenCalledTimes(2);
    expect(cache.remember.mock.calls[0]?.[0]).not.toEqual(cache.remember.mock.calls[1]?.[0]);
    expectPublicVisibility(queryBuilders[0]);
    expect(queryBuilders[1]?.conditions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ condition: 'food.status = :publicFoodStatus' }),
      ]),
    );
  });
});
