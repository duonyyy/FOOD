import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  AuthGuard,
  CurrentActor,
  type CurrentActor as CurrentActorData,
} from 'src/features/users/public-api';
import { CustomerDeliveryService } from '../services/customer-delivery.service';
import type { DeliveryQuoteRequest } from '../types/delivery-integration.types';

@Controller('customer/deliveries')
@ApiTags('customer-delivery')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
export class CustomerDeliveryController {
  constructor(private readonly customerDeliveryService: CustomerDeliveryService) {}

  @Get('orders/:orderId/track')
  @ApiOperation({ summary: 'Track delivery status and driver details for an order' })
  @ApiResponse({ status: 200, description: 'Delivery tracking information' })
  @ApiUnauthorizedResponse({ description: 'JWT is missing or invalid' })
  @ApiNotFoundResponse({ description: 'Delivery tracking was not found' })
  async trackOrder(@Param('orderId') orderId: string, @CurrentActor() actor: CurrentActorData) {
    const tracking = await this.customerDeliveryService.getDeliveryTracking(orderId, actor.userId);
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
    return this.customerDeliveryService.quoteDelivery(request);
  }
}
