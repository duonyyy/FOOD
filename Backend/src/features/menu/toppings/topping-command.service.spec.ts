import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ToppingCommandService } from './topping-command.service';

describe('ToppingCommandService', () => {
  const food = { id: 'food-1', restaurant: { id: 'restaurant-1' } };

  function createService(overrides: Record<string, unknown> = {}) {
    const ownership = {
      assertCanManageRestaurant: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
    const foodRepository = { findOne: jest.fn().mockResolvedValue(food) };
    const duplicateQuery = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    const toppingRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'topping-1',
        name: 'Cheese',
        price: 2,
        food,
      }),
      createQueryBuilder: jest.fn().mockReturnValue(duplicateQuery),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'topping-1', ...value })),
      remove: jest.fn(),
    };
    const cache = { deleteByPattern: jest.fn().mockResolvedValue(0) };
    const service = new ToppingCommandService(
      foodRepository as never,
      toppingRepository as never,
      ownership as never,
      cache as never,
    );
    return { service, ownership, toppingRepository, duplicateQuery, cache };
  }

  it('checks restaurant ownership before creating a topping', async () => {
    const ownership = {
      assertCanManageRestaurant: jest.fn().mockRejectedValue(new ForbiddenException()),
    };
    const { service, toppingRepository } = createService(ownership);

    await expect(
      service.create('food-1', { name: 'Cheese', price: '2' }, 'owner-a'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(toppingRepository.save).not.toHaveBeenCalled();
  });

  it('rejects duplicate topping names for one food', async () => {
    const { service, duplicateQuery } = createService();
    duplicateQuery.getOne.mockResolvedValue({ id: 'existing' });

    await expect(
      service.create('food-1', { name: ' cheese ', price: '2' }, 'owner-a'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('writes a topping and invalidates menu cache', async () => {
    const { service, cache } = createService();

    await service.create('food-1', { name: 'Cheese', price: '2.50' }, 'owner-a');

    expect(cache.deleteByPattern).toHaveBeenCalledWith('food:*');
    expect(cache.deleteByPattern).toHaveBeenCalledWith('food:restaurant:restaurant-1:*');
  });
});
