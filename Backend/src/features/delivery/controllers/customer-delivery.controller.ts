import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/features/auth/guards/auth.guard';
import { DeliveryQuoteRequest } from '../contracts/delivery-quote.port';
import { DeliveryIntegrationService } from '../services/integration/delivery-integration.service';

@Controller('customer/deliveries')
@ApiTags('customer-delivery')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
export class CustomerDeliveryController {
  constructor(private readonly deliveryIntegrationService: DeliveryIntegrationService) {}

  @Get('orders/:orderId/track')
  @ApiOperation({ summary: 'Track delivery status and driver details for an order' })
  @ApiResponse({ status: 200, description: 'Delivery tracking information' })
  async trackOrder(@Param('orderId') orderId: string) {
    return this.deliveryIntegrationService.getDeliveryTracking(orderId);
  }

  @Post('quote')
  @ApiOperation({ summary: 'Calculate estimated delivery fee and duration' })
  @ApiResponse({ status: 200, description: 'Delivery quote estimation' })
  async getDeliveryQuote(@Body() request: DeliveryQuoteRequest) {
    return this.deliveryIntegrationService.quoteDelivery(request);
  }
}
