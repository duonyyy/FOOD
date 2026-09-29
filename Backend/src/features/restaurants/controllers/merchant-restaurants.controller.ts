import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/features/auth/public-api';
import { CurrentActor, type CurrentActorData } from 'src/features/users/public-api';
import { PrivateFileResponseDto } from '../dto/private-file-response.dto';
import { RestaurantDiscoveryQueryDto } from '../dto/restaurant-discovery-query.dto';
import { RequestRestaurantDto, UpdateOwnedRestaurantDto } from '../dto/restaurant-request.dto';
import { RestaurantResponseDto } from '../dto/restaurant-response.dto';
import { MerchantRestaurantsService } from '../services/merchant-restaurants.service';

type RestaurantFiles = {
  avatar?: Express.Multer.File[];
  backgroundImage?: Express.Multer.File[];
  certificateImage?: Express.Multer.File[];
};

const restaurantFilesInterceptor = FileFieldsInterceptor(
  [
    { name: 'avatar', maxCount: 1 },
    { name: 'backgroundImage', maxCount: 1 },
    { name: 'certificateImage', maxCount: 1 },
  ],
  { limits: { fileSize: 5 * 1024 * 1024 } },
);

@ApiTags('Merchant restaurants')
@ApiBearerAuth('bearer')
@Controller('merchant/restaurants')
@UseGuards(AuthGuard)
export class MerchantRestaurantsController {
  constructor(private readonly merchantRestaurantsService: MerchantRestaurantsService) {}

  @Post()
  @UseInterceptors(restaurantFilesInterceptor)
  @ApiOperation({ summary: 'Gửi yêu cầu mở nhà hàng cho tài khoản đang đăng nhập' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: RequestRestaurantDto })
  @ApiCreatedResponse({ type: RestaurantResponseDto })
  @ApiResponse({ status: 400, description: 'Thông tin nhà hàng, địa chỉ hoặc tệp không hợp lệ' })
  @ApiUnauthorizedResponse({ description: 'JWT không hợp lệ hoặc thiếu' })
  async requestRestaurant(
    @CurrentActor() actor: CurrentActorData,
    @Body() request: RequestRestaurantDto,
    @UploadedFiles() files: RestaurantFiles,
  ): Promise<RestaurantResponseDto> {
    const restaurant = await this.merchantRestaurantsService.requestRestaurantWithFiles(
      actor.userId,
      request,
      files?.avatar?.[0],
      files?.backgroundImage?.[0],
      files?.certificateImage?.[0],
    );
    return RestaurantResponseDto.fromRestaurant(restaurant);
  }

  @Get('my')
  @ApiOperation({ summary: 'Lấy hồ sơ nhà hàng của tài khoản đang đăng nhập' })
  @ApiResponse({ status: 200, type: RestaurantResponseDto })
  @ApiNotFoundResponse({ description: 'Tài khoản chưa có nhà hàng' })
  async getMyRestaurant(
    @CurrentActor() actor: CurrentActorData,
    @Query() query: RestaurantDiscoveryQueryDto,
  ): Promise<RestaurantResponseDto> {
    const restaurant = await this.merchantRestaurantsService.findByOwnerId(
      actor.userId,
      query.lat,
      query.lng,
    );
    if (!restaurant) {
      throw new ForbiddenException('You do not own a restaurant');
    }
    return RestaurantResponseDto.fromRestaurant(restaurant);
  }

  @Get(':id/certificate')
  @ApiOperation({ summary: 'Lấy URL tạm thời cho giấy chứng nhận của nhà hàng mình' })
  @ApiResponse({ status: 200, type: PrivateFileResponseDto })
  async getCertificateDownloadUrl(
    @Param('id') id: string,
    @CurrentActor() actor: CurrentActorData,
  ): Promise<PrivateFileResponseDto> {
    await this.assertRestaurantOwner(id, actor.userId);
    return { url: await this.merchantRestaurantsService.getCertificateDownloadUrl(id) };
  }

  @Put(':id/files')
  @UseInterceptors(restaurantFilesInterceptor)
  @ApiOperation({ summary: 'Cập nhật hồ sơ và ảnh của nhà hàng mình sở hữu' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateOwnedRestaurantDto })
  @ApiResponse({ status: 200, type: RestaurantResponseDto })
  @ApiForbiddenResponse({ description: 'Không sở hữu nhà hàng này' })
  async updateWithFiles(
    @Param('id') id: string,
    @CurrentActor() actor: CurrentActorData,
    @Body() update: UpdateOwnedRestaurantDto,
    @UploadedFiles() files: RestaurantFiles,
  ): Promise<RestaurantResponseDto> {
    await this.assertRestaurantOwner(id, actor.userId);
    const restaurant = await this.merchantRestaurantsService.updateWithFiles(
      id,
      update,
      files?.avatar?.[0],
      files?.backgroundImage?.[0],
      files?.certificateImage?.[0],
    );
    return RestaurantResponseDto.fromRestaurant(restaurant);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin nhà hàng mình sở hữu' })
  @ApiResponse({ status: 200, type: RestaurantResponseDto })
  @ApiForbiddenResponse({ description: 'Không sở hữu nhà hàng này' })
  async update(
    @Param('id') id: string,
    @CurrentActor() actor: CurrentActorData,
    @Body() update: UpdateOwnedRestaurantDto,
  ): Promise<RestaurantResponseDto> {
    await this.assertRestaurantOwner(id, actor.userId);
    return RestaurantResponseDto.fromRestaurant(
      await this.merchantRestaurantsService.update(id, update),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa nhà hàng mình sở hữu' })
  @ApiResponse({ status: 204, description: 'Đã xóa' })
  @ApiForbiddenResponse({ description: 'Không sở hữu nhà hàng này' })
  async remove(@Param('id') id: string, @CurrentActor() actor: CurrentActorData): Promise<void> {
    await this.assertRestaurantOwner(id, actor.userId);
    await this.merchantRestaurantsService.remove(id);
  }

  private async assertRestaurantOwner(restaurantId: string, actorId: string): Promise<void> {
    const restaurant = await this.merchantRestaurantsService.findByOwnerId(actorId);
    if (!restaurant || restaurant.id !== restaurantId) {
      throw new ForbiddenException('You can only modify your own restaurant');
    }
  }
}
