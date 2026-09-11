import {
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedRequest } from 'src/common/auth/authenticated-request';
import { Permission } from 'src/constants/permission.enum';
import { Permissions } from 'src/features/auth/decorators/permissions.decorator';
import { RolesGuard } from 'src/features/auth/guards/roles.guard';
import { AdminFoodService } from '../services/admin-food.service';
import { CustomerFoodService } from '../services/customer-food.service';

@Controller('foods')
@ApiTags('admin-foods')
@ApiBearerAuth('bearer')
export class AdminFoodController {
  private readonly logger = new Logger(AdminFoodController.name);

  constructor(
    private readonly adminFoodService: AdminFoodService,
    private readonly customerFoodService: CustomerFoodService,
  ) {}

  @Get('all')
  @UseGuards(RolesGuard)
  @Permissions(Permission.FOOD.READ)
  async findAllForStore(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('restaurantId') restaurantId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
    @Query('sortBy')
    sortBy?: 'newest' | 'nearby' | 'hot' | 'most_review' | 'most_buy' | 'rating' | 'price' | 'name',
    @Query('lat') lat?: number,
    @Query('lng') lng?: number,
  ) {
    const actualPageSize = limit || pageSize;

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

    if (normalizedSearch) {
      this.logger.debug('Using search functionality');
      return await this.adminFoodService.searchFoodsForStore(
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

    if (normalizedRestaurantId && normalizedCategoryId) {
      return await this.customerFoodService.findByRestaurantAndCategory(
        normalizedRestaurantId,
        normalizedCategoryId,
        page,
        actualPageSize,
        latitude,
        longitude,
        normalizedStatus,
        sortBy,
      );
    } else if (normalizedRestaurantId) {
      return await this.customerFoodService.findByRestaurant(
        normalizedRestaurantId,
        page,
        actualPageSize,
        latitude,
        longitude,
        normalizedStatus,
        sortBy,
      );
    } else if (normalizedCategoryId) {
      return await this.customerFoodService.findByCategory(
        normalizedCategoryId,
        page,
        actualPageSize,
        latitude,
        longitude,
      );
    } else {
      return await this.customerFoodService.findAll(
        page,
        actualPageSize,
        latitude,
        longitude,
        normalizedStatus,
      );
    }
  }

  @Delete(':id/admin')
  @UseGuards(RolesGuard)
  @Permissions(Permission.FOOD.DELETE)
  async deleteFood(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Not authenticated');
    return await this.adminFoodService.deleteByAdmin(id);
  }
}
