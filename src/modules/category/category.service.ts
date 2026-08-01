import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Category } from 'src/entities/category.entity';
import { buildCacheKey } from 'src/infra/cache/cache-key.util';
import { CACHE_TTL_SECONDS } from 'src/infra/cache/cache.constants';
import { AppCacheService } from 'src/infra/cache/cache.service';
import { Repository } from 'typeorm';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    private readonly cacheService: AppCacheService,
  ) {}

  private async clearCategoryCache(): Promise<void> {
    await Promise.all([
      this.cacheService.deleteByPattern('category:*'),
      this.cacheService.deleteByPattern('food:*'),
    ]);
  }

  /**
   * Create a new category
   *
   * @param createCategoryDto The category data to create
   * @returns The created category
   */
  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    try {
      const category = this.categoryRepository.create(createCategoryDto);
      const savedCategory = await this.categoryRepository.save(category);
      await this.clearCategoryCache();
      return savedCategory;
    } catch (error) {
      throw new Error(`Failed to create category: ${error.message}`);
    }
  }

  /**
   * Get all categories with pagination and food count
   *
   * @param page The page number
   * @param pageSize The number of items per page
   * @returns List of all categories with pagination metadata and food count
   */
  async findAll(
    page = 1,
    pageSize = 10,
  ): Promise<{
    items: (Category & { foodCount: number })[]; // Category items will now have a foodCount property
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const cacheKey = buildCacheKey('category:findAll', { page, pageSize });
    return this.cacheService.remember(cacheKey, CACHE_TTL_SECONDS.VERY_LONG, async () => {
      const skip = (page - 1) * pageSize;

      const [categories, totalItems] = await this.categoryRepository
        .createQueryBuilder('category')
        // This maps the count of 'foods' relation to 'category.foodCount'
        .loadRelationCountAndMap('category.foodCount', 'category.foods')
        // You can add default ordering if desired, e.g., by name
        .orderBy('category.name', 'ASC')
        .skip(skip)
        .take(pageSize)
        .getManyAndCount();

      // The 'foods' relation itself will not be loaded on the category objects,
      // only its count will be available as 'foodCount'.
      return {
        items: categories as (Category & { foodCount: number })[], // Cast to include foodCount
        totalItems,
        page,
        pageSize,
        totalPages: Math.ceil(totalItems / pageSize),
      };
    });
  }

  /**
   * Get a specific category by ID
   *
   * @param id The category ID
   * @returns The category details
   */
  async findOne(id: string): Promise<Category> {
    const cacheKey = buildCacheKey('category:findOne', { id });
    return this.cacheService.remember(cacheKey, CACHE_TTL_SECONDS.LONG, async () => {
      const category = await this.categoryRepository.findOne({
        where: { id },
        relations: ['foods'],
      });

      if (!category) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      return category;
    });
  }

  /**
   * Update a category
   *
   * @param id The category ID
   * @param updateCategoryDto The updated category data
   * @returns The updated category
   */
  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);

    // Update category with new values
    Object.assign(category, updateCategoryDto);

    const updatedCategory = await this.categoryRepository.save(category);
    await this.clearCategoryCache();
    return updatedCategory;
  }

  /**
   * Delete a category
   *
   * @param id The category ID
   */
  async remove(id: string): Promise<void> {
    const result = await this.categoryRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    await this.clearCategoryCache();
  }
}
