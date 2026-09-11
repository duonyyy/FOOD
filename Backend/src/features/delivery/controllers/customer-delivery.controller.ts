import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ORDER_TRACKING_READER,
  type OrderTrackingReaderPort,
} from 'src/features/orders/order-tracking-reader.public-api';
import {
  AuthGuard,
  CurrentActor,
  type CurrentActor as CurrentActorData,
} from 'src/features/users/public-api';
import { DeliveryQuoteRequest } from '../contracts/delivery-quote.port';
import { DeliveryIntegrationService } from '../services/integration/delivery-integration.service';

@Controller('customer/deliveries')
@ApiTags('customer-delivery')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
export class CustomerDeliveryController {
  constructor(
    @Inject(ORDER_TRACKING_READER)
    private readonly orderTrackingReader: OrderTrackingReaderPort,
    private readonly deliveryIntegrationService: DeliveryIntegrationService,
  ) {}

  @Get('orders/:orderId/track')
  @ApiOperation({ summary: 'Track delivery status and driver details for an order' })
  @ApiResponse({ status: 200, description: 'Delivery tracking information' })
  @ApiUnauthorizedResponse({ description: 'JWT is missing or invalid' })
  @ApiNotFoundResponse({ description: 'Delivery tracking was not found' })
  async trackOrder(@Param('orderId') orderId: string, @CurrentActor() actor: CurrentActorData) {
    const order = await this.orderTrackingReader.findCustomerOrderForTracking(
      orderId,
      actor.userId,
    );

    // The same 404 is returned for an unknown order and one owned by another customer.
    if (!order) {
      throw new NotFoundException('Delivery tracking not found');
    }

    const tracking = await this.deliveryIntegrationService.getDeliveryTracking(order.orderId);
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
