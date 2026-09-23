import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Permissions, RolesGuard } from 'src/features/auth/public-api';
import { CurrentActor, type CurrentActorData } from 'src/features/users/public-api';
import { Permission } from 'src/shared/types/enums/permission.enum';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { AdminOrdersService } from '../services/admin-orders.service';

@Controller('orders')
@ApiTags('orders')
export class AdminOrdersController {
  private readonly logger = new Logger(AdminOrdersController.name);

  constructor(private readonly adminOrders: AdminOrdersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @ApiBearerAuth('bearer')
  @Permissions(Permission.ORDER.READ)
  @ApiOperation({ summary: 'Get all orders in system (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of all orders' })
  @ApiResponse({ status: 403, description: 'Forbidden if actor lacks ORDER.READ capability' })
  getAllOrders() {
    return this.adminOrders.getAllOrders();
  }

  @Put('admin/:id/status')
  @UseGuards(RolesGuard)
  @ApiBearerAuth('bearer')
  @Permissions(Permission.ORDER.WRITE)
  @ApiOperation({ summary: 'Update order status by Administrator' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Order status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status or transition' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async adminUpdateOrderStatus(
    @Param('id') orderId: string,
    @Body() body: UpdateOrderStatusDto,
    @CurrentActor() actor: CurrentActorData,
  ) {
    if (!body?.status) {
      throw new BadRequestException('Status is required');
    }

    this.logger.log(`Admin ${actor.userId} updating order ${orderId} status to ${body.status}`);
    return this.adminOrders.adminUpdateOrderStatus(orderId, body.status);
  }
}
