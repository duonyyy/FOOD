import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Logger,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/features/auth/public-api';
import { RestaurantProfileService } from 'src/features/restaurants/public-api';
import { CurrentActor, type CurrentActorData } from 'src/features/users/public-api';
import { OrderStatus } from 'src/shared/types/enums/order-status.enum';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { OrderActorPolicy } from '../services/order-core.service';
import { OrderService } from '../services/order.service';

@Controller('orders')
@ApiTags('orders')
export class MerchantOrdersController {
  private readonly logger = new Logger(MerchantOrdersController.name);
  private readonly actorPolicy = new OrderActorPolicy();

  constructor(
    private readonly orderService: OrderService,
    private readonly restaurantService: RestaurantProfileService,
  ) {}

  @Get('restaurant/my')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get orders belonging to the authenticated merchant restaurant' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of restaurant orders' })
  @ApiResponse({ status: 403, description: 'User does not own any restaurant' })
  async getOrdersByMyRestaurant(
    @CurrentActor() actor: CurrentActorData,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 10,
    @Query('status') status?: string,
  ) {
    const userId = actor.userId;
    this.logger.log(`Getting orders for restaurant owned by user: ${userId}`);

    const userRestaurant = await this.restaurantService.findByOwnerId(userId);
    if (!userRestaurant) {
      throw new ForbiddenException('You do not own any restaurant');
    }

    return this.orderService.getOrdersByRestaurant(userRestaurant.id, page, pageSize, status);
  }

  @Put(':id/status')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update order status by restaurant owner' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Order status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status or transition' })
  @ApiResponse({ status: 403, description: 'User does not own the restaurant for this order' })
  async updateOrderStatus(
    @Param('id') orderId: string,
    @Body() body: UpdateOrderStatusDto,
    @CurrentActor() actor: CurrentActorData,
  ) {
    const merchantId = actor.userId;
    const currentOrder = await this.orderService.getOrderById(orderId);
    this.actorPolicy.assertCanManageRestaurantOrder(currentOrder, merchantId);

    const status = body?.status;
    if (!status) {
      throw new BadRequestException('Status is required');
    }

    const allowedStatuses: OrderStatus[] = [
      OrderStatus.CONFIRMED,
      OrderStatus.DELIVERING,
      OrderStatus.SHIPPER_RECEIVED,
      OrderStatus.COMPLETED,
      OrderStatus.CANCELED,
    ];
    if (!allowedStatuses.includes(status)) {
      throw new BadRequestException(
        `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`,
      );
    }

    const updatedOrder = await this.orderService.updateOrderStatus(orderId, status);

    this.logger.log(
      `Order ${orderId} status updated to ${status} by restaurant owner ${merchantId}. User ${updatedOrder.user?.id ?? currentOrder.user?.id ?? 'unknown'} notified.`,
    );

    return updatedOrder;
  }
}
