import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Permissions, RolesGuard } from 'src/features/auth/public-api';
import { CurrentActor, type CurrentActorData } from 'src/features/users/public-api';
import { Permission } from 'src/shared/types/enums/permission.enum';
import { PrivateFileResponseDto } from '../dto/private-file-response.dto';
import { ApproveRestaurantDto, RejectRestaurantDto } from '../dto/restaurant-approval.dto';
import { RestaurantDiscoveryQueryDto } from '../dto/restaurant-discovery-query.dto';
import { RestaurantPageResponseDto, RestaurantResponseDto } from '../dto/restaurant-response.dto';
import { AdminRestaurantsService } from '../services/admin-restaurants.service';

@ApiTags('Admin restaurants')
@ApiBearerAuth('bearer')
@Controller('admin/restaurants')
@UseGuards(RolesGuard)
export class AdminRestaurantsController {
  constructor(private readonly adminRestaurantsService: AdminRestaurantsService) {}

  @Get('requests')
  @Permissions(Permission.STORE.READ)
  @ApiOperation({ summary: 'Liệt kê yêu cầu mở nhà hàng đang chờ duyệt' })
  @ApiResponse({ status: 200, type: RestaurantPageResponseDto })
  @ApiUnauthorizedResponse({ description: 'JWT không hợp lệ hoặc thiếu quyền' })
  async getRestaurantRequests(
    @Query() query: RestaurantDiscoveryQueryDto,
  ): Promise<RestaurantPageResponseDto> {
    const page = await this.adminRestaurantsService.getRestaurantRequests(
      query.page,
      query.pageSize,
      query.lat,
      query.lng,
    );
    return {
      ...page,
      items: page.items.map((item) => RestaurantResponseDto.fromRestaurant(item)),
    };
  }

  @Get(':id/certificate')
  @Permissions(Permission.STORE.READ)
  @ApiOperation({ summary: 'Lấy URL tạm thời cho giấy chứng nhận để kiểm duyệt' })
  @ApiResponse({ status: 200, type: PrivateFileResponseDto })
  async getCertificateDownloadUrl(@Param('id') id: string): Promise<PrivateFileResponseDto> {
    return { url: await this.adminRestaurantsService.getCertificateDownloadUrl(id) };
  }

  @Put(':id/approve')
  @Permissions(Permission.STORE.WRITE)
  @ApiOperation({ summary: 'Duyệt yêu cầu mở nhà hàng và ghi audit' })
  @ApiResponse({ status: 200, type: RestaurantResponseDto })
  @ApiResponse({ status: 409, description: 'Nhà hàng không còn ở trạng thái chờ duyệt' })
  async approveRestaurant(
    @Param('id') id: string,
    @CurrentActor() actor: CurrentActorData,
    @Body() input: ApproveRestaurantDto,
  ): Promise<RestaurantResponseDto> {
    return RestaurantResponseDto.fromRestaurant(
      await this.adminRestaurantsService.approveRestaurant(id, actor.userId, input),
    );
  }

  @Put(':id/reject')
  @Permissions(Permission.STORE.WRITE)
  @ApiOperation({ summary: 'Từ chối yêu cầu mở nhà hàng, bắt buộc lý do và ghi audit' })
  @ApiResponse({ status: 200, type: RestaurantResponseDto })
  @ApiResponse({ status: 400, description: 'Thiếu hoặc sai lý do từ chối' })
  @ApiResponse({ status: 409, description: 'Nhà hàng không còn ở trạng thái chờ duyệt' })
  async rejectRestaurant(
    @Param('id') id: string,
    @CurrentActor() actor: CurrentActorData,
    @Body() input: RejectRestaurantDto,
  ): Promise<RestaurantResponseDto> {
    return RestaurantResponseDto.fromRestaurant(
      await this.adminRestaurantsService.rejectRestaurant(id, actor.userId, input),
    );
  }

  @Delete('requests/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(Permission.STORE.DELETE)
  @ApiOperation({ summary: 'Xóa yêu cầu mở nhà hàng đang chờ duyệt' })
  @ApiResponse({ status: 204, description: 'Đã xóa' })
  async deleteRestaurantRequest(@Param('id') id: string): Promise<void> {
    await this.adminRestaurantsService.deleteRestaurantRequest(id);
  }
}
