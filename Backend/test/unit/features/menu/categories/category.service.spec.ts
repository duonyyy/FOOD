import { ConflictException, NotFoundException } from '@nestjs/common';
import { CategoryService } from 'src/features/menu/categories/category.service';
import type { AppCacheService } from 'src/infra/cache/public-api';

describe('CategoryService', () => {
  const cache: Pick<AppCacheService, 'remember' | 'deleteByPattern'> & {
    deleteByPattern: jest.Mock;
  } = {
    remember: async <T>(_key: string, _ttl: number, loader: () => Promise<T>) => loader(),
    deleteByPattern: jest.fn(() => Promise.resolve(0)),
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
    const service = new CategoryService(repository as never, cache as never);

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

  it('preserves mapped food fields, explicit foodCount and nullable values', async () => {
    const category = {
      id: 'category-2',
      name: null,
      image: null,
      foodCount: 4,
      foods: [
        {
          id: 'food-2',
          name: null,
          image: null,
          imageUrls: null,
          description: null,
          price: null,
          discountPercent: null,
          status: null,
          tag: null,
          rating: null,
          preparationTime: null,
        },
      ],
    };
    const repository = { findOne: jest.fn().mockResolvedValue(category) };
    const service = new CategoryService(repository as never, cache as never);

    await expect(service.findOne('category-2')).resolves.toEqual({
      id: 'category-2',
      name: null,
      image: null,
      foodCount: 4,
      foods: [
        {
          id: 'food-2',
          name: null,
          image: null,
          imageUrls: null,
          description: null,
          price: null,
          discountPercent: null,
          status: null,
          tag: null,
          rating: null,
          preparationTime: null,
        },
      ],
    });
  });

  it('throws 404 without mutating a missing category', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    const service = new CategoryService(repository as never, cache as never);

    await expect(service.update('missing', { name: 'New name' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('invalidates catalog and food caches after a write', async () => {
    const category = { id: 'category-1', name: 'Old', image: null, foods: [] };
    const repository = {
      findOne: jest.fn().mockResolvedValue(category),
      create: jest.fn((value: unknown) => value),
      save: jest.fn().mockImplementation((value: unknown) => Promise.resolve(value)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = new CategoryService(repository as never, cache as never);

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
    const service = new CategoryService(repository as never, cache as never);

    await expect(service.create({ name: ' Món Việt ' })).rejects.toBeInstanceOf(ConflictException);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
