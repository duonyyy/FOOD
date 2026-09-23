import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OrderDeliveryService } from 'src/features/orders/public-api';
import {
  AuthGuard,
  CurrentActor,
  type CurrentActor as CurrentActorData,
} from 'src/features/users/public-api';
import { DeliveryIntegrationService } from '../services/integration/delivery-integration.service';
import type { DeliveryQuoteRequest } from '../types/delivery-integration.types';

@Controller('customer/deliveries')
@ApiTags('customer-delivery')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
export class CustomerDeliveryController {
  constructor(
    private readonly orderDelivery: OrderDeliveryService,
    private readonly deliveryIntegrationService: DeliveryIntegrationService,
  ) {}

  @Get('orders/:orderId/track')
  @ApiOperation({ summary: 'Track delivery status and driver details for an order' })
  @ApiResponse({ status: 200, description: 'Delivery tracking information' })
  @ApiUnauthorizedResponse({ description: 'JWT is missing or invalid' })
  @ApiNotFoundResponse({ description: 'Delivery tracking was not found' })
  async trackOrder(@Param('orderId') orderId: string, @CurrentActor() actor: CurrentActorData) {
    await this.orderDelivery.assertCustomerCanTrackOrder(orderId, actor.userId);
    const tracking = await this.deliveryIntegrationService.getDeliveryTracking(orderId);
    const { shipper, ...trackingResponse } = tracking;

    return {
      ...trackingResponse,
      shipper: shipper
        ? {
            id: shipper.id,
            name: shipper.name,
            rating: shipper.rating,
          }
        : null,
    };
  }

  @Post('quote')
  @ApiOperation({ summary: 'Calculate estimated delivery fee and duration' })
  @ApiResponse({ status: 200, description: 'Delivery quote estimation' })
  async getDeliveryQuote(@Body() request: DeliveryQuoteRequest) {
    return this.deliveryIntegrationService.quoteDelivery(request);
  }
}
