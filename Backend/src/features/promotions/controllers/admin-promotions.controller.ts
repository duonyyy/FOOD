import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions, RolesGuard } from 'src/features/auth/public-api';
import { Permission } from 'src/shared/types/enums/permission.enum';
import { CreatePromotionDto } from '../dto/create-promotion.dto';
import { UpdatePromotionDto } from '../dto/update-promotion.dto';
import { AdminPromotionsService } from '../services/admin-promotions.service';

@Controller('promotions')
@ApiTags('promotions')
@UseGuards(RolesGuard)
@ApiBearerAuth('bearer')
export class AdminPromotionsController {
  constructor(private readonly adminPromotionsService: AdminPromotionsService) {}

  @Post()
  @Permissions(Permission.PROMOTION.CREATE)
  createPromotion(@Body() createPromotionDto: CreatePromotionDto) {
    return this.adminPromotionsService.createPromotion(createPromotionDto);
  }

  @Get()
  @Permissions(Permission.PROMOTION.READ)
  getAllPromotions() {
    return this.adminPromotionsService.getAllPromotions();
  }

  @Get(':id')
  @Permissions(Permission.PROMOTION.READ)
  getPromotionById(@Param('id') id: string) {
    return this.adminPromotionsService.getPromotionById(id);
  }

  @Put(':id')
  @Permissions(Permission.PROMOTION.WRITE)
  updatePromotion(@Param('id') id: string, @Body() updatePromotionDto: UpdatePromotionDto) {
    return this.adminPromotionsService.updatePromotion(id, updatePromotionDto);
  }

  @Delete(':id')
  @Permissions(Permission.PROMOTION.DELETE)
  deletePromotion(@Param('id') id: string) {
    return this.adminPromotionsService.deletePromotion(id);
  }
}
