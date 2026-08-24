import { ConflictException, NotFoundException } from '@nestjs/common';
import type { CachePort } from 'src/infra/contracts/cache.port';
import { CategoryService } from './category.service';

describe('CategoryService', () => {
  const cache: CachePort & { deleteByPattern: jest.Mock } = {
    remember: async <T>(_key: string, _ttl: number, loader: () => Promise<T>) => loader(),
    deleteByPattern: jest.fn(async () => 0),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a DTO snapshot instead of the TypeORM category entity', async () => {
    const category = {
      id: 'category-1',
      name: 'Món Việt',
      image: 'image.png',
      foods: [
        {
          id: 'food-1',
          name: 'Phở',
          image: 'food.png',
          imageUrls: [],
          description: 'Soup',
          price: 50000,
          discountPercent: 0,
          status: 'available',
          tag: null,
          rating: 4.5,
          preparationTime: 10,
        },
      ],
    };
    const repository = {
      findOne: jest.fn().mockResolvedValue(category),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    const service = new CategoryService(repository as never, cache);

    const result = await service.findOne('category-1');

    expect(result).toEqual({
      id: 'category-1',
      name: 'Món Việt',
      image: 'image.png',
      foodCount: 1,
      foods: [expect.objectContaining({ id: 'food-1', name: 'Phở' })],
    });
    expect(result).not.toBe(category);
  });

  it('throws 404 without mutating a missing category', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    const service = new CategoryService(repository as never, cache);

    await expect(service.update('missing', { name: 'New name' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('invalidates catalog and food caches after a write', async () => {
    const category = { id: 'category-1', name: 'Old', image: null, foods: [] };
    const repository = {
      findOne: jest.fn().mockResolvedValue(category),
      create: jest.fn((value) => value),
      save: jest.fn().mockImplementation(async (value) => value),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = new CategoryService(repository as never, cache);

    await service.update('category-1', { name: 'New' });

    expect(cache.deleteByPattern).toHaveBeenCalledWith('category:*');
    expect(cache.deleteByPattern).toHaveBeenCalledWith('food:*');
  });

  it('rejects a duplicate category name before saving', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 'existing' }),
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      create: jest.fn(),
      save: jest.fn(),
    };
    const service = new CategoryService(repository as never, cache);

    await expect(service.create({ name: ' Món Việt ' })).rejects.toBeInstanceOf(ConflictException);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
