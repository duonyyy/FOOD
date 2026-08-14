import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Param,
  Post,
  Query,
  Redirect,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { CheckoutStatus } from '../entities/checkout.entity';
import {
  MomoResultQueryDto,
  PaymentOrderIdDto,
  PaymentWebhookDto,
  ProcessPaymentDto,
} from './dto/payment-request.dto';
import { PaymentService } from './payment.service';

@Controller('payment')
@ApiTags('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly configService: ConfigService,
  ) {}

  @Post('process/:checkoutId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Process an authenticated checkout' })
  @ApiResponse({ status: 201, description: 'Checkout processing result' })
  @ApiUnauthorizedResponse({ description: 'JWT is missing or invalid' })
  async processPayment(
    @Param('checkoutId') checkoutId: string,
    @Body() paymentDetails: ProcessPaymentDto,
  ) {
    return this.paymentService.processPayment(checkoutId, { ...paymentDetails });
  }

  @Post('cancel/:checkoutId')
  @UseGuards(AuthGuard)
  async cancelCheckout(@Param('checkoutId') checkoutId: string) {
    return this.paymentService.cancelCheckout(checkoutId);
  }

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Receive a signed payment provider webhook' })
  @ApiResponse({ status: 200, description: 'Webhook accepted or idempotently replayed' })
  @ApiResponse({ status: 400, description: 'Signature, amount, currency or payload is invalid' })
  async handleWebhook(
    @Body() payload: PaymentWebhookDto,
    @Headers('x-payment-signature') signature?: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing payment signature');
    }

    return this.paymentService.handleWebhookEvent(payload, signature);
  }

  @Get('checkout/:checkoutId')
  @UseGuards(AuthGuard)
  async getCheckoutStatus(@Param('checkoutId') checkoutId: string) {
    // This would typically be implemented in the service
    // For now, we'll just return a placeholder
    return {
      checkoutId,
      status: CheckoutStatus.PENDING,
    };
  }

  @Get('momo/result')
  async handleMomoResult(@Query() query: MomoResultQueryDto) {
    const { orderId, resultCode, message } = query;

    if (!orderId) {
      throw new BadRequestException('Missing order ID');
    }

    // Process the result
    const result = await this.paymentService.handleMomoResult(orderId, resultCode, message ?? '');

    // Redirect to the frontend with the result
    return {
      success: result.success,
      verificationPending: true,
      orderId,
      message: result.message,
    };
  }

  @Post('momo/check-status')
  async checkMomoStatus(@Body() body: PaymentOrderIdDto) {
    const { orderId } = body;
    if (!orderId) {
      throw new BadRequestException('Missing order ID');
    }

    return this.paymentService.checkMomoStatus(orderId);
  }

  /**
   * Handle VNPAY payment result (return URL)
   * @param query Query parameters from VNPAY return URL
   * @returns Payment result with redirection
   */
  @Get('vnpay/result')
  @Redirect()
  async handleVnpayResult(@Query() query: Record<string, string>) {
    try {
      const result = await this.paymentService.handleVnpayWebhook(query);
      const providerReference = query.vnp_TxnRef;

      if (result.outcome === 'succeeded') {
        return {
          url: `${this.configService.get<string>('FRONTEND_URL')}/payment-success?orderId=${providerReference}`,
        };
      }
      return {
        url: `${this.configService.get<string>('FRONTEND_URL')}/payment-failed?orderId=${providerReference}&message=Payment%20failed`,
      };
    } catch (error) {
      this.logger.error(`VNPAY result error: ${(error as Error).message}`);
      return {
        url: `${this.configService.get<string>('FRONTEND_URL')}/payment-failed?message=${encodeURIComponent('An error occurred during payment processing')}`,
      };
    }
  }

  /**
   * Handle VNPAY IPN (Instant Payment Notification)
   * @param query Query parameters from VNPAY IPN
   * @returns IPN processing result
   */
  @Get('webhook/vnpay')
  async handleVnpayIpn(@Query() query: Record<string, string>) {
    try {
      const acknowledgement = await this.paymentService.handleVnpayWebhook(query);
      return {
        RspCode: '00',
        Message: acknowledgement.duplicate ? 'duplicate' : 'success',
      };
    } catch (error) {
      this.logger.error(`VNPAY IPN error: ${(error as Error).message}`);
      return error instanceof BadRequestException
        ? { RspCode: '97', Message: 'Fail checksum or invalid callback' }
        : { RspCode: '99', Message: 'Internal server error' };
    }
  }

  /**
   * Check VNPAY payment status
   * @param orderId Order ID to check
   * @returns Payment status information
   */
  @Get('vnpay/status')
  @UseGuards(AuthGuard)
  async checkVnpayStatus(@Query('orderId') orderId: string) {
    if (!orderId) {
      throw new BadRequestException('Order ID is required');
    }

    return this.paymentService.checkPaymentStatus(orderId, 'vnpay');
  }
}
