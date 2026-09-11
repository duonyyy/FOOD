import {
  Controller,
  DefaultValuePipe,
  Get,
  Logger,
  Param,
  ParseFloatPipe,
  ParseIntPipe,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CustomerFoodService } from '../services/customer-food.service';

@Controller('foods')
@ApiTags('foods')
export class CustomerFoodController {
  private readonly logger = new Logger(CustomerFoodController.name);

  constructor(private readonly foodService: CustomerFoodService) {}

  @Get()
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('lat') lat?: number,
    @Query('lng') lng?: number,
  ) {
    return await this.foodService.findAll(
      page,
      pageSize,
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
    );
  }

  @Get('top-selling')
  async findTopSelling(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('lat') lat?: number,
    @Query('lng') lng?: number,
  ) {
    return await this.foodService.findTopSelling(
      page,
      pageSize,
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
    );
  }

  @Get('newest')
  async findNewest(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('lat') lat?: number,
    @Query('lng') lng?: number,
  ) {
    return await this.foodService.findNewest(
      page,
      pageSize,
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
    );
  }

  @Get('with-discount')
  async findWithDiscount(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('lat') lat?: number,
    @Query('lng') lng?: number,
  ) {
    return await this.foodService.findWithDiscount(
      page,
      pageSize,
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
    );
  }

  @Get('search')
  async searchFoods(
    @Query('query') query: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('lat', new DefaultValuePipe(10.7769), ParseFloatPipe) lat: number = 10.7769, // HCM default
    @Query('lng', new DefaultValuePipe(106.7009), ParseFloatPipe) lng: number = 106.7009,
    @Query('radius', new DefaultValuePipe(5), ParseIntPipe) radius: number = 5, // km
  ) {
    return await this.foodService.searchFoods(query, page, pageSize, lat, lng, radius);
  }

  @Get('by-name')
  async findByName(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('lat', new DefaultValuePipe(10.7769), ParseFloatPipe) lat: number = 10.7769, // HCM default
    @Query('lng', new DefaultValuePipe(106.7009), ParseFloatPipe) lng: number = 106.7009,
    @Query('radius', new DefaultValuePipe(5), ParseIntPipe) radius: number = 5, // km
    @Query('name') name?: string,
    @Query('categoryIds') categoryIds?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
  ) {
    this.logger.debug('Controller findByName');
    this.logger.debug('Raw query parameters received', {
      name,
      page,
      pageSize,
      lat,
      lng,
      radius,
      categoryIds,
      minPrice,
      maxPrice,
    });

    let categoryIdList: string[] | undefined = undefined;
    if (categoryIds) {
      categoryIdList = categoryIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      this.logger.debug(`Parsed categoryIds: ${categoryIdList.join(',')}`);
    }
    if (name && name.trim() === '') {
      name = undefined;
    }

    this.logger.debug('Calling service with parameters', {
      name,
      page,
      pageSize,
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      radius,
      categoryIdList,
      minPrice: minPrice !== undefined ? Number(minPrice) : undefined,
      maxPrice: maxPrice !== undefined ? Number(maxPrice) : undefined,
    });

    const result = await this.foodService.findByName(
      name,
      page,
      pageSize,
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
      radius,
      categoryIdList,
      minPrice !== undefined ? Number(minPrice) : undefined,
      maxPrice !== undefined ? Number(maxPrice) : undefined,
    );

    this.logger.debug('Service returned', {
      totalItems: result.totalItems,
      itemsCount: result.items.length,
      page: result.page,
      totalPages: result.totalPages,
    });
    this.logger.debug('End Controller findByName');

    return result;
  }

  @Get('top')
  async getTopFoodsByRestaurant(
    @Query('restaurantId') restaurantId: string,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ) {
    if (!restaurantId) {
      throw new UnauthorizedException('restaurantId is required');
    }
    return await this.foodService.getTopFoodsByRestaurant(restaurantId, limit);
  }

  @Get('restaurant/:restaurantId')
  async findByRestaurant(
    @Param('restaurantId') restaurantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('lat') lat?: number,
    @Query('lng') lng?: number,
  ) {
    return await this.foodService.findByRestaurant(
      restaurantId,
      page,
      pageSize,
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
    );
  }

  @Get('restaurant/:restaurantId/top-selling')
  async findTopSellingByRestaurant(
    @Param('restaurantId') restaurantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('lat') lat?: number,
    @Query('lng') lng?: number,
  ) {
    return await this.foodService.findTopSellingByRestaurant(
      restaurantId,
      page,
      pageSize,
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
    );
  }

  @Get('restaurant/:restaurantId/with-discount')
  async findWithDiscountByRestaurant(
    @Param('restaurantId') restaurantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('lat') lat?: number,
    @Query('lng') lng?: number,
  ) {
    return await this.foodService.findWithDiscountByRestaurant(
      restaurantId,
      page,
      pageSize,
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
    );
  }

  @Get('category/:categoryId')
  async findByCategory(
    @Param('categoryId') categoryId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('lat') lat?: number,
    @Query('lng') lng?: number,
  ) {
    return await this.foodService.findByCategory(
      categoryId,
      page,
      pageSize,
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
    );
  }

  @Get('category/:categoryId/restaurant/:restaurantId')
  async findByCategoryAndRestaurant(
    @Param('categoryId') categoryId: string,
    @Param('restaurantId') restaurantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('lat') lat?: number,
    @Query('lng') lng?: number,
  ) {
    return await this.foodService.findByCategoryAndRestaurant(
      categoryId,
      restaurantId,
      page,
      pageSize,
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Query('lat') lat?: number, @Query('lng') lng?: number) {
    return await this.foodService.findOne(
      id,
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
    );
  }

  @Get(':id/toppings')
  async getToppings(@Param('id') foodId: string) {
    return await this.foodService.getToppingsByFood(foodId);
  }
}
