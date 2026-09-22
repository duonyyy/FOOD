import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Order } from 'src/entities/order.entity';
import { AuthGuard } from 'src/features/auth/public-api';
import { PaymentService } from 'src/features/payments/public-api';
import { CurrentActor, type CurrentActorData } from 'src/features/users/public-api';
import { pubSub } from 'src/pubsub';
import { CreateOrderRequestDto } from '../dto/create-order-request.dto';
import { CreateOrderDto } from '../dto/create-order.dto';
import { PaymentDto } from '../dto/payment.dto';
import { OrderActorPolicy } from '../services/order-core.service';
import { OrderService } from '../services/order.service';

@Controller('orders')
@ApiTags('orders')
export class CustomerOrdersController {
  private readonly logger = new Logger(CustomerOrdersController.name);
  private readonly actorPolicy = new OrderActorPolicy();

  constructor(
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
  ) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create an order using server-authoritative pricing' })
  @ApiCreatedResponse({ description: 'Order and optional checkout created' })
  @ApiUnauthorizedResponse({ description: 'JWT is missing or invalid' })
  async createOrder(@Body() body: CreateOrderRequestDto, @CurrentActor() actor: CurrentActorData) {
    const userId = actor.userId;
    this.logger.log({
      event: 'order_create_requested',
      actorId: userId,
      restaurantId: body.restaurantId,
      itemCount: Array.isArray(body.orderDetails) ? body.orderDetails.length : 0,
    });

    const orderDetails = Array.isArray(body.orderDetails)
      ? body.orderDetails.map((detail) => ({
          foodId: detail.foodId,
          quantity: detail.quantity,
          price: detail.price ?? '0',
          note: detail.note || '',
          selectedToppings: (detail.selectedToppings || []).map((topping) => ({
            id: topping.id,
            name: topping.name ?? '',
            price: topping.price ?? 0,
          })),
          discountPercent: detail.discountPercent ?? 0,
        }))
      : [];

    let addressId = body.addressId;
    let isTemporaryAddress = false;

    if (body.address && !body.addressId) {
      this.logger.log({
        event: 'temporary_delivery_address_requested',
        actorId: userId,
      });

      addressId = await this.orderService.createTemporaryAddress(body.address, userId);
      isTemporaryAddress = true;
      this.logger.log(`Temporary address created with ID: ${addressId}`);
    }
    if (!addressId) {
      throw new BadRequestException('Address ID or custom address is required');
    }

    const createOrderDto: CreateOrderDto = {
      userId,
      restaurantId: body.restaurantId,
      addressId,
      total: body.total,
      note: body.note,
      paymentMethod: body.paymentMethod,
      promotionCode: body.promotionCode,
      requestedDeliveryTime: body.requestedDeliveryTime,
      deliveryType: body.deliveryType,
      orderDetails,
    };

    this.logger.log({
      event: 'order_create_command_prepared',
      actorId: userId,
      restaurantId: createOrderDto.restaurantId,
      itemCount: createOrderDto.orderDetails.length,
    });

    try {
      const order = await this.orderService.createOrder(createOrderDto);
      this.logger.log(`Order created with ID: ${order.id}`);

      let paymentUrl: string | undefined;
      let checkoutId: string | undefined;
      if (body.paymentMethod && body.paymentMethod !== 'cod') {
        const checkout = await this.paymentService.createCheckout(
          {
            orderId: order.id,
            customerId: userId,
            amount: Number(order.total),
            currency: 'VND',
          },
          body.paymentMethod,
        );
        paymentUrl = checkout.paymentUrl;
        checkoutId = checkout.id;

        this.logger.log({
          event: 'checkout_created',
          orderId: order.id,
          checkoutId,
        });
      }

      if (body.paymentMethod === 'cod') {
        const updatedOrder = await this.orderService.getOrderById(order.id);
        await pubSub.publish('orderCreated', {
          orderCreated: updatedOrder,
        });
        this.logger.log(`Order ${order.id} will be paid on delivery (COD)`);
        paymentUrl = process.env.FRONTEND_URL + `/order/${order.id}`;
      }

      return {
        order: {
          id: order.id,
          status: order.status,
          total: order.total,
          paymentMethod: order.paymentMethod,
          createdAt: order.createdAt,
        },
        paymentUrl,
        checkoutId,
        temporaryAddress: isTemporaryAddress,
      };
    } catch (error) {
      if (isTemporaryAddress && addressId) {
        try {
          await this.orderService.deleteTemporaryAddress(addressId);
          this.logger.log(`Cleaned up temporary address ${addressId} after order creation failure`);
        } catch (cleanupError: unknown) {
          this.logger.error(
            `Failed to clean up temporary address ${addressId}: ${errorMessage(cleanupError)}`,
          );
        }
      }
      throw error;
    }
  }

  @Get('my')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get order history of currently authenticated customer' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of customer orders' })
  async getMyOrders(
    @CurrentActor() actor: CurrentActorData,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 10,
    @Query('status') status?: string,
  ) {
    return this.orderService.getOrdersByUser(actor.userId, page, pageSize, status);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get order details by order ID' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiQuery({ name: 'review', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Order details' })
  @ApiResponse({ status: 403, description: 'Forbidden if actor cannot access this order' })
  async getOrderById(
    @Param('id') id: string,
    @CurrentActor() actor: CurrentActorData,
    @Query('review') review?: boolean,
  ) {
    return this.getOrderForActor(id, actor.userId, actor.role, review);
  }

  @Get('user/:userId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get orders by user ID (Self or Admin)' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'List of orders for user' })
  @ApiResponse({ status: 403, description: 'Forbidden if actor is not the target user or admin' })
  getOrdersByUser(@Param('userId') userId: string, @CurrentActor() actor: CurrentActorData) {
    this.actorPolicy.assertCanReadUserOrders(userId, actor.userId, actor.role);
    return this.orderService.getOrdersByUser(userId);
  }

  @Get(':id/details')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get order line items details' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Order line items' })
  @ApiResponse({ status: 403, description: 'Forbidden if actor cannot access this order' })
  async getOrderDetails(@Param('id') id: string, @CurrentActor() actor: CurrentActorData) {
    await this.getOrderForActor(id, actor.userId, actor.role);
    return this.orderService.getOrderDetails(id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Delete order by customer' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Order deleted successfully' })
  @ApiResponse({ status: 403, description: 'Only order owner can delete order' })
  async deleteOrder(@Param('id') id: string, @CurrentActor() actor: CurrentActorData) {
    const order = await this.orderService.getOrderById(id);
    this.actorPolicy.assertCanDelete(order, actor.userId);
    return this.orderService.deleteOrder(id);
  }

  @Post(':id/payment')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Process payment for order' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Payment processed' })
  @ApiResponse({ status: 403, description: 'Only order owner can pay for order' })
  async processPayment(
    @Param('id') id: string,
    @Body() paymentData: PaymentDto,
    @CurrentActor() actor: CurrentActorData,
  ) {
    const order = await this.orderService.getOrderById(id);
    this.actorPolicy.assertCanPay(order, actor.userId);
    return this.orderService.processPayment(id, paymentData);
  }

  private async getOrderForActor(
    orderId: string,
    actorId: string,
    actorRole?: string,
    includeReviewInfo: boolean = false,
  ): Promise<Order> {
    const order = await this.orderService.getOrderById(orderId, includeReviewInfo);
    this.actorPolicy.assertCanRead(order, actorId, actorRole);
    return order;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
