import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Logger,
  Param,
  ParseFloatPipe,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { Permissions } from 'src/auth/decorators/permissions.decorator';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AuthenticatedRequest } from 'src/common/auth/authenticated-request';
import { Permission } from 'src/constants/permission.enum';
import { Food } from 'src/entities/food.entity';
import { FoodQueryService } from '../../features/menu/foods/food-query.service';
import { FoodCommandService } from '../../features/menu/services/food-command.service';
import { ToppingCommandService } from '../../features/menu/toppings/topping-command.service';
import { CreateFoodDto } from './dto/create-food.dto';
import { CreateToppingDto } from './dto/create-topping.dto';
import { UpdateFoodDto } from './dto/update-food.dto';
import { UpdateToppingDto } from './dto/update-topping.dto';

@Controller('foods')
@ApiTags('foods')
export class FoodController {
  private readonly logger = new Logger(FoodController.name);
  constructor(
    private readonly foodService: FoodQueryService,
    private readonly foodCommandService: FoodCommandService,
    private readonly toppingCommandService: ToppingCommandService,
  ) {}

  @Post()
  @UseGuards(AuthGuard)
  async create(
    @Body() createFoodDto: CreateFoodDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Food> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Not authenticated');
    // Clean up empty string UUIDs
    const cleanedDto = {
      ...createFoodDto,
      categoryId: createFoodDto.categoryId === '' ? undefined : createFoodDto.categoryId,
    };
    const dto = plainToInstance(CreateFoodDto, cleanedDto);
    return await this.foodCommandService.create(dto, userId);
  }
  @Get('all')
  @UseGuards(RolesGuard)
  @Permissions(Permission.FOOD.READ)
  async findAllForStore(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number, // Add limit param
    @Query('search') search?: string, // Add search param
    @Query('restaurantId') restaurantId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string, // Add status param
    @Query('sortBy')
    sortBy?: 'newest' | 'nearby' | 'hot' | 'most_review' | 'most_buy' | 'rating' | 'price' | 'name',
    @Query('lat') lat?: number,
    @Query('lng') lng?: number,
  ) {
    // Use limit if provided, otherwise use pageSize
    const actualPageSize = limit || pageSize;

    // Normalize parameters - treat empty strings and 'all' as undefined
    const normalizedRestaurantId =
      restaurantId && restaurantId !== 'all' && restaurantId.trim() !== ''
        ? restaurantId
        : undefined;
    const normalizedCategoryId =
      categoryId && categoryId !== 'all' && categoryId.trim() !== '' ? categoryId : undefined;
    const normalizedStatus =
      status && status !== 'all' && status.trim() !== '' ? status : undefined;
    const normalizedSearch = search && search.trim() !== '' ? search.trim() : undefined;

    this.logger.debug('Normalized parameters', {
      normalizedRestaurantId,
      normalizedCategoryId,
      normalizedStatus,
      normalizedSearch,
      actualPageSize,
    });

    const latitude = lat ? Number(lat) : undefined;
    const longitude = lng ? Number(lng) : undefined;

    // If search is provided, use search functionality
    if (normalizedSearch) {
      this.logger.debug('Using search functionality');
      return await this.foodService.searchFoodsForStore(
        normalizedSearch,
        page,
        actualPageSize,
        latitude,
        longitude,
        normalizedRestaurantId,
        normalizedCategoryId,
        sortBy,
      );
    }

    // Route to appropriate service method based on filters
    if (normalizedRestaurantId && normalizedCategoryId) {
      // Both restaurant and category filters
      return await this.foodService.findByRestaurantAndCategory(
        normalizedRestaurantId,
        normalizedCategoryId,
        page,
        actualPageSize,
        latitude,
        longitude,
        normalizedStatus, // Pass status filter
        sortBy,
      );
    } else if (normalizedRestaurantId) {
      // Restaurant filter only
      return await this.foodService.findByRestaurant(
        normalizedRestaurantId,
        page,
        actualPageSize,
        latitude,
        longitude,
        normalizedStatus, // Pass status filter
        sortBy,
      );
    } else if (normalizedCategoryId) {
      // Category filter only
      return await this.foodService.findByCategory(
        normalizedCategoryId,
        page,
        actualPageSize,
        latitude,
        longitude,
      );
    } else {
      // No filters - get all foods
      return await this.foodService.findAll(
        page,
        actualPageSize,
        latitude,
        longitude,
        normalizedStatus, // Pass status filter
      );
    }
  }

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
    @Query('name') name?: string, // Made optional
    @Query('categoryIds') categoryIds?: string, // comma-separated string
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

    // Parse categoryIds to array if provided
    let categoryIdList: string[] | undefined = undefined;
    if (categoryIds) {
      categoryIdList = categoryIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      this.logger.debug(`Parsed categoryIds: ${categoryIdList.join(',')}`);
    }
    if (name && name.trim() === '') {
      name = undefined; // Treat empty name as undefined
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
      name, // Pass undefined if not provided
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

  @Put(':id')
  @UseGuards(AuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateFoodDto: UpdateFoodDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Not authenticated');
    // Convert to DTO instance for validation and transformation
    const dto = plainToInstance(UpdateFoodDto, updateFoodDto);
    return await this.foodCommandService.update(id, dto, userId);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Not authenticated');
    return await this.foodCommandService.remove(id, userId);
  }

  @Put(':id/status')
  @UseGuards(AuthGuard)
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Not authenticated');
    if (status !== 'available' && status !== 'hidden') {
      throw new BadRequestException('Status must be either "available" or "hidden"');
    }
    return await this.foodCommandService.updateStatus(id, status, userId);
  }

  @Delete(':id/admin')
  @UseGuards(RolesGuard)
  @Permissions(Permission.FOOD.DELETE)
  async deleteFood(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Not authenticated');
    return await this.foodCommandService.delete(id);
  }

  @Post(':id/toppings')
  @UseGuards(AuthGuard)
  async addTopping(
    @Param('id') foodId: string,
    @Body() createToppingDto: CreateToppingDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<import('src/entities/topping.entity').Topping> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Not authenticated');

    return await this.toppingCommandService.create(foodId, createToppingDto, userId);
  }

  @Put('toppings/:toppingId')
  @UseGuards(AuthGuard)
  async updateTopping(
    @Param('toppingId') toppingId: string,
    @Body() updateToppingDto: UpdateToppingDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<import('src/entities/topping.entity').Topping> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Not authenticated');

    return await this.toppingCommandService.update(toppingId, updateToppingDto, userId);
  }

  @Delete('toppings/:toppingId')
  @UseGuards(AuthGuard)
  async removeTopping(
    @Param('toppingId') toppingId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Not authenticated');

    return await this.toppingCommandService.remove(toppingId, userId);
  }

  @Get(':id/toppings')
  async getToppings(@Param('id') foodId: string) {
    return await this.foodService.getToppingsByFood(foodId);
  }
}
