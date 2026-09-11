import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from 'src/constants/permission.enum';
import { Permissions, RolesGuard } from 'src/features/auth/public-api';
import { CreatePromotionDto } from '../dto/create-promotion.dto';
import { UpdatePromotionDto } from '../dto/update-promotion.dto';
import { PromotionService } from '../services/promotion.service';

@Controller('promotions')
@ApiTags('promotions')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  @Post()
  @UseGuards(RolesGuard)
  @ApiBearerAuth('bearer')
  @Permissions(Permission.PROMOTION.CREATE)
  createPromotion(@Body() createPromotionDto: CreatePromotionDto) {
    return this.promotionService.createPromotion(createPromotionDto);
  }

  @Get('all')
  async getPublicActivePromotions(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('name') name?: string, // <-- Add name query param
  ) {
    return this.promotionService.getActivePromotionsWithPagination(page, pageSize, undefined, name);
  }

  @Get()
  @UseGuards(RolesGuard)
  @ApiBearerAuth('bearer')
  @Permissions(Permission.PROMOTION.READ)
  getAllPromotions() {
    return this.promotionService.getAllPromotions();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @ApiBearerAuth('bearer')
  @Permissions(Permission.PROMOTION.CREATE)
  getPromotionById(@Param('id') id: string) {
    return this.promotionService.getPromotionById(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @ApiBearerAuth('bearer')
  @Permissions(Permission.PROMOTION.WRITE)
  updatePromotion(@Param('id') id: string, @Body() updatePromotionDto: UpdatePromotionDto) {
    return this.promotionService.updatePromotion(id, updatePromotionDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @ApiBearerAuth('bearer')
  @Permissions(Permission.PROMOTION.DELETE)
  deletePromotion(@Param('id') id: string) {
    return this.promotionService.deletePromotion(id);
  }
}
