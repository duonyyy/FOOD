import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Category } from 'src/entities/category.entity';
import { CACHE_PORT, type CachePort } from 'src/infra/contracts/cache.port';
import { Repository } from 'typeorm';
import { type CategoryReaderPort, type CategorySnapshot } from '../contracts/category-reader.port';
import { toCategoryResponse } from './category.mapper';
import { CategoryListResponseDto, CategoryResponseDto } from './dto/category-response.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

const CATEGORY_LIST_TTL_SECONDS = 1_800;
const CATEGORY_DETAIL_TTL_SECONDS = 300;

@Injectable()
export class CategoryService implements CategoryReaderPort {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @Inject(CACHE_PORT)
    private readonly cache: CachePort,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<CategoryResponseDto> {
    try {
      const category = this.categoryRepository.create({
        name: createCategoryDto.name.trim(),
        image: createCategoryDto.image?.trim(),
      });
      const savedCategory = await this.categoryRepository.save(category);
      await this.clearCategoryCache();
      return toCategoryResponse(savedCategory);
    } catch (error) {
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
      response.items = categories.map(toCategoryResponse);
      response.totalItems = totalItems;
      response.page = page;
      response.pageSize = pageSize;
      response.totalPages = Math.ceil(totalItems / pageSize);
      return response;
    });
  }

  async findCategoryById(categoryId: string): Promise<CategorySnapshot | null> {
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
      category.name = updateCategoryDto.name.trim();
    }
    if (updateCategoryDto.image !== undefined) {
      category.image = updateCategoryDto.image.trim();
    }

    const updatedCategory = await this.categoryRepository.save(category);
    await this.clearCategoryCache();
    return toCategoryResponse(updatedCategory);
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

      return category ? toCategoryResponse(category) : null;
    });
  }
}
