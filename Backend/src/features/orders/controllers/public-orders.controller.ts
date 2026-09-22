import { Body, Controller, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CalculateOrderDto, CalculateOrderWithCustomAddressDto } from '../dto/calculate-order.dto';
import { ValidatePromotionDto } from '../dto/validate-promotion.dto';
import { OrderService } from '../services/order.service';

@Controller('orders')
@ApiTags('orders')
export class PublicOrdersController {
  private readonly logger = new Logger(PublicOrdersController.name);

  constructor(private readonly orderService: OrderService) {}

  @Post('calculate')
  @ApiOperation({ summary: 'Calculate order price and shipping fee with a saved address' })
  @ApiResponse({ status: 200, description: 'Order pricing calculation successful' })
  @ApiResponse({ status: 400, description: 'Validation failed or missing required fields' })
  async calculateOrder(@Body() body: CalculateOrderDto) {
    this.logger.log({
      event: 'order_calculation_requested',
      restaurantId: body.restaurantId,
      itemCount: Array.isArray(body.items) ? body.items.length : 0,
    });

    if (
      !body.addressId ||
      !body.restaurantId ||
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      return { error: 'Missing addressId, restaurantId, or items' };
    }

    return this.orderService.calculateOrder({
      addressId: body.addressId,
      restaurantId: body.restaurantId,
      items: body.items,
      promotionCode: body.promotionCode,
    });
  }

  @Post('calculate-custom')
  @ApiOperation({ summary: 'Calculate order price and shipping fee with custom delivery address' })
  @ApiResponse({ status: 200, description: 'Order pricing calculation successful' })
  @ApiResponse({ status: 400, description: 'Validation failed or missing required fields' })
  async calculateOrderWithCustomAddress(@Body() body: CalculateOrderWithCustomAddressDto) {
    this.logger.log({
      event: 'custom_address_order_calculation_requested',
      restaurantId: body.restaurantId,
      itemCount: Array.isArray(body.items) ? body.items.length : 0,
    });

    if (
      !body.address ||
      !body.restaurantId ||
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      return { error: 'Missing address, restaurantId, or items' };
    }

    return this.orderService.calculateOrderWithCustomAddress(
      body.address,
      body.restaurantId,
      body.items,
      body.promotionCode,
    );
  }

  @Post('validate-promotion')
  @ApiOperation({ summary: 'Validate promotion rules for an order' })
  @ApiResponse({ status: 200, description: 'Promotion validation result' })
  @ApiResponse({ status: 400, description: 'Missing required fields or validation failure' })
  async validatePromotion(@Body() body: ValidatePromotionDto) {
    this.logger.log({ event: 'promotion_validation_requested' });

    if (
      !body.promotionCode ||
      !body.addressId ||
      !body.restaurantId ||
      !Array.isArray(body.items)
    ) {
      return {
        valid: false,
        error: 'Missing required fields: promotionCode, addressId, restaurantId, or items',
      };
    }

    return this.orderService.validatePromotionForOrder(
      body.promotionCode,
      body.addressId,
      body.restaurantId,
      body.items,
    );
  }
}
