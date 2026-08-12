import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RestaurantDiscoveryQueryDto } from '../dto/restaurant-discovery-query.dto';
import { RestaurantPageResponseDto, RestaurantResponseDto } from '../dto/restaurant-response.dto';
import { toRestaurantResponse } from '../restaurant.mapper';
import { RestaurantDiscoveryService } from '../services/restaurant-discovery.service';

@ApiTags('Restaurant discovery')
@Controller('restaurants')
export class RestaurantDiscoveryController {
  constructor(private readonly restaurantDiscoveryService: RestaurantDiscoveryService) {}

  @Get('all')
  @ApiOperation({ summary: 'Liệt kê nhà hàng đã được duyệt' })
  @ApiResponse({ status: 200, type: RestaurantPageResponseDto })
  async findAll(@Query() query: RestaurantDiscoveryQueryDto): Promise<RestaurantPageResponseDto> {
    return this.toPage(
      await this.restaurantDiscoveryService.findAll(
        query.page,
        query.pageSize,
        query.lat,
        query.lng,
      ),
    );
  }

  @Get('popular')
  @ApiOperation({ summary: 'Lấy nhà hàng đã duyệt kèm tối đa ba món đang bán' })
  @ApiResponse({ status: 200, schema: { example: { items: [{ id: 'uuid', foods: [] }] } } })
  async getPopularRestaurants(@Query() query: RestaurantDiscoveryQueryDto) {
    const { items } = await this.restaurantDiscoveryService.getTopRestaurants(
      1,
      3,
      query.lat,
      query.lng,
    );
    return {
      items: await Promise.all(
        items.map(async (restaurant) => ({
          ...toRestaurantResponse(restaurant),
          foods: await this.restaurantDiscoveryService.getFoodsByRestaurantId(restaurant.id, 1, 3),
        })),
      ),
    };
  }

  @Get('preview')
  @ApiOperation({ summary: 'Lấy bản xem trước của các nhà hàng đã duyệt' })
  @ApiResponse({ status: 200, type: RestaurantPageResponseDto })
  async getPreview(
    @Query() query: RestaurantDiscoveryQueryDto,
  ): Promise<RestaurantPageResponseDto> {
    return this.toPage(
      await this.restaurantDiscoveryService.getPreview(
        query.page,
        query.pageSize,
        query.lat,
        query.lng,
      ),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một nhà hàng đã được duyệt' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: RestaurantResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy nhà hàng đã duyệt' })
  async findOne(
    @Param('id') id: string,
    @Query() query: RestaurantDiscoveryQueryDto,
  ): Promise<RestaurantResponseDto> {
    return toRestaurantResponse(
      await this.restaurantDiscoveryService.findOne(id, query.lat, query.lng),
    );
  }

  private toPage(page: {
    items: Parameters<typeof toRestaurantResponse>[0][];
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }): RestaurantPageResponseDto {
    return { ...page, items: page.items.map(toRestaurantResponse) };
  }
}
