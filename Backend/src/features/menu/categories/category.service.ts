import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Category } from 'src/entities/category.entity';
import { AppCacheService } from 'src/infra/cache/public-api';
import { Repository } from 'typeorm';
import { type CategorySummary } from '../types/category.types';
import {
  CategoryFoodResponseDto,
  CategoryListResponseDto,
  CategoryResponseDto,
} from './dto/category-response.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

const CATEGORY_LIST_TTL_SECONDS = 1_800;
const CATEGORY_DETAIL_TTL_SECONDS = 300;

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly cache: AppCacheService,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<CategoryResponseDto> {
    try {
      await this.assertUniqueName(createCategoryDto.name);
      const category = this.categoryRepository.create({
        name: createCategoryDto.name.trim(),
        image: createCategoryDto.image?.trim(),
      });
      const savedCategory = await this.categoryRepository.save(category);
      await this.clearCategoryCache();
      return this.toCategoryResponse(savedCategory);
    } catch (error) {
      if (error instanceof ConflictException || isUniqueViolation(error)) {
        throw new ConflictException('A category with this name already exists');
      }
      throw new InternalServerErrorException(
        `Failed to create category: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  async findAll(page = 1, pageSize = 10): Promise<CategoryListResponseDto> {
    const cacheKey = `category:list:${page}:${pageSize}`;
    return this.cache.remember(cacheKey, CATEGORY_LIST_TTL_SECONDS, async () => {
      const skip = (page - 1) * pageSize;
      const [categories, totalItems] = await this.categoryRepository
        .createQueryBuilder('category')
        .loadRelationCountAndMap('category.foodCount', 'category.foods')
        .orderBy('category.name', 'ASC')
        .skip(skip)
        .take(pageSize)
        .getManyAndCount();

      const response = new CategoryListResponseDto();
      response.items = categories.map((category) => this.toCategoryResponse(category));
      response.totalItems = totalItems;
      response.page = page;
      response.pageSize = pageSize;
      response.totalPages = Math.ceil(totalItems / pageSize);
      return response;
    });
  }

  async findCategoryById(categoryId: string): Promise<CategorySummary | null> {
    const category = await this.findCategoryResponse(categoryId);

    return category
      ? {
          categoryId: category.id,
          name: category.name,
          image: category.image,
          foodCount: category.foodCount,
        }
      : null;
  }

  async findOne(categoryId: string): Promise<CategoryResponseDto> {
    const category = await this.findCategoryResponse(categoryId);

    if (!category) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }

    return category;
  }

  async update(
    categoryId: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.categoryRepository.findOne({ where: { id: categoryId } });

    if (!category) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }

    if (updateCategoryDto.name !== undefined) {
      await this.assertUniqueName(updateCategoryDto.name, categoryId);
      category.name = updateCategoryDto.name.trim();
    }
    if (updateCategoryDto.image !== undefined) {
      category.image = updateCategoryDto.image.trim();
    }

    let updatedCategory: Category;
    try {
      updatedCategory = await this.categoryRepository.save(category);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A category with this name already exists');
      }
      throw error;
    }
    await this.clearCategoryCache();
    return this.toCategoryResponse(updatedCategory);
  }

  async remove(categoryId: string): Promise<void> {
    const result = await this.categoryRepository.delete(categoryId);

    if (result.affected === 0) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }

    await this.clearCategoryCache();
  }

  private async clearCategoryCache(): Promise<void> {
    await Promise.all([
      this.cache.deleteByPattern('category:*'),
      this.cache.deleteByPattern('food:*'),
    ]);
  }

  private async findCategoryResponse(categoryId: string): Promise<CategoryResponseDto | null> {
    const cacheKey = `category:detail:${categoryId}`;
    return this.cache.remember(cacheKey, CATEGORY_DETAIL_TTL_SECONDS, async () => {
      const category = await this.categoryRepository.findOne({
        where: { id: categoryId },
        relations: ['foods'],
      });

      return category ? this.toCategoryResponse(category) : null;
    });
  }

  private async assertUniqueName(name: string, exceptId?: string): Promise<void> {
    const queryBuilder = this.categoryRepository.createQueryBuilder?.('category');
    if (!queryBuilder) return;

    const existing = await queryBuilder
      .where('LOWER(TRIM(category.name)) = LOWER(TRIM(:name))', { name: name.trim() })
      .andWhere(exceptId ? 'category.id <> :exceptId' : '1 = 1', { exceptId })
      .getOne();
    if (existing) {
      throw new ConflictException('A category with this name already exists');
    }
  }

  private toCategoryResponse(category: Category & { foodCount?: number }): CategoryResponseDto {
    const response = new CategoryResponseDto();
    response.id = category.id;
    response.name = category.name ?? null;
    response.image = category.image ?? null;
    response.foodCount = category.foodCount ?? category.foods?.length ?? 0;
    if (category.foods) {
      response.foods = category.foods.map((food) => {
        const item = new CategoryFoodResponseDto();
        item.id = food.id;
        item.name = food.name ?? null;
        item.image = food.image ?? null;
        item.imageUrls = food.imageUrls ?? null;
        item.description = food.description ?? null;
        item.price = food.price ?? null;
        item.discountPercent = food.discountPercent ?? null;
        item.status = food.status ?? null;
        item.tag = food.tag ?? null;
        item.rating = food.rating ?? null;
        item.preparationTime = food.preparationTime ?? null;
        return item;
      });
    }
    return response;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
