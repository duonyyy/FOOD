import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PublicPromotionsService } from '../services/public-promotions.service';

@Controller('promotions')
@ApiTags('promotions')
export class PublicPromotionsController {
  constructor(private readonly publicPromotionsService: PublicPromotionsService) {}

  @Get('all')
  getPublicActivePromotions(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('name') name?: string,
  ) {
    return this.publicPromotionsService.getActivePromotionsWithPagination(
      page,
      pageSize,
      undefined,
      name,
    );
  }
}
