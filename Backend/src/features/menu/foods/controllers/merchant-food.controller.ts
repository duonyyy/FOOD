import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { AuthenticatedRequest } from 'src/common/auth/authenticated-request';
import { Food } from 'src/entities/food.entity';
import { Topping } from 'src/entities/topping.entity';
import { AuthGuard } from 'src/features/auth/public-api';
import { CreateFoodDto } from '../dto/create-food.dto';
import { CreateToppingDto } from '../dto/toppings/create-topping.dto';
import { UpdateToppingDto } from '../dto/toppings/update-topping.dto';
import { UpdateFoodDto } from '../dto/update-food.dto';
import { FoodMerchantService } from '../services/food-merchant.service';
import { FoodToppingService } from '../services/food-topping.service';

@Controller('foods')
@ApiTags('merchant-foods')
export class MerchantFoodController {
  constructor(
    private readonly foodService: FoodMerchantService,
    private readonly foodToppingService: FoodToppingService,
  ) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
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
    return await this.foodService.create(dto, userId);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  async update(
    @Param('id') id: string,
    @Body() updateFoodDto: UpdateFoodDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Not authenticated');
    // Convert to DTO instance for validation and transformation
    const dto = plainToInstance(UpdateFoodDto, updateFoodDto);
    return await this.foodService.update(id, dto, userId);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Not authenticated');
    return await this.foodService.remove(id, userId);
  }

  @Put(':id/status')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
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
    return await this.foodService.updateStatus(id, status, userId);
  }

  @Post(':id/toppings')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  async addTopping(
    @Param('id') foodId: string,
    @Body() createToppingDto: CreateToppingDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Topping> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Not authenticated');

    return await this.foodToppingService.create(foodId, createToppingDto, userId);
  }

  @Put('toppings/:toppingId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  async updateTopping(
    @Param('toppingId') toppingId: string,
    @Body() updateToppingDto: UpdateToppingDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Topping> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Not authenticated');

    return await this.foodToppingService.update(toppingId, updateToppingDto, userId);
  }

  @Delete('toppings/:toppingId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  async removeTopping(
    @Param('toppingId') toppingId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Not authenticated');

    return await this.foodToppingService.remove(toppingId, userId);
  }
}
