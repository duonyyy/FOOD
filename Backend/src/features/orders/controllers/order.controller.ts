import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Logger,
  Param,
  Post,
  Put,
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
import { Permission } from 'src/constants/permission.enum';
import { Order } from 'src/entities/order.entity';
import { AuthGuard, Permissions, RolesGuard } from 'src/features/auth/public-api';
import { DeliveryAssignmentScheduler } from 'src/features/delivery/public-api';
import { PaymentService } from 'src/features/payments/public-api';
import { RestaurantProfileService } from 'src/features/restaurants/public-api';
import { CurrentActor, type CurrentActorData } from 'src/features/users/public-api';
import { pubSub } from 'src/pubsub';
import { CalculateOrderDto, CalculateOrderWithCustomAddressDto } from '../dto/calculate-order.dto';
import { CreateOrderRequestDto } from '../dto/create-order-request.dto';
import { CreateOrderDto } from '../dto/create-order.dto';
import { PaymentDto } from '../dto/payment.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { ValidatePromotionDto } from '../dto/validate-promotion.dto';
import { OrderActorPolicy, OrderStatus, parseOrderStatus } from '../services/order-core.service';
import { OrderService } from '../services/order.service';

@Controller('orders')
@ApiTags('orders')
export class OrderController {
  private readonly logger = new Logger(OrderController.name);
  private readonly actorPolicy = new OrderActorPolicy();

  constructor(
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
    private readonly restaurantService: RestaurantProfileService,
    private readonly pendingAssignmentService: DeliveryAssignmentScheduler,
  ) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create an order using server-authoritative pricing' })
  @ApiCreatedResponse({ description: 'Order and optional checkout created' })
  @ApiUnauthorizedResponse({ description: 'JWT is missing or invalid' })
  async createOrder(@Body() body: CreateOrderRequestDto, @CurrentActor() actor: CurrentActorData) {
    const userId = actor.userId;
    this.logger.log(`Received order creation request: ${JSON.stringify(body)}`);

    // Map orderDetails if present
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

    // 🔥 CHECK: If custom address is provided, create a temporary address record
    let addressId = body.addressId;
    let isTemporaryAddress = false;

    if (body.address && !body.addressId) {
      this.logger.log(`🏠 Creating temporary address for custom delivery location`);
      this.logger.log(`📍 Custom address: ${JSON.stringify(body.address)}`);

      // Create a temporary address record for this order
      addressId = await this.orderService.createTemporaryAddress(body.address, userId);
      isTemporaryAddress = true;

      this.logger.log(`✅ Temporary address created with ID: ${addressId}`);
    }
    if (!addressId) {
      throw new BadRequestException('Address ID or custom address is required');
    }

    // Map to DTO
    const createOrderDto: CreateOrderDto = {
      userId,
      restaurantId: body.restaurantId,
      addressId: addressId, // Use either provided addressId or newly created temporary address
      total: body.total,
      note: body.note,
      paymentMethod: body.paymentMethod,
      promotionCode: body.promotionCode,
      requestedDeliveryTime: body.requestedDeliveryTime,
      deliveryType: body.deliveryType,
      orderDetails,
    };

    this.logger.log(`Creating order with DTO: ${JSON.stringify(createOrderDto)}`);

    try {
      // 1. Create the order
      const order = await this.orderService.createOrder(createOrderDto);

      this.logger.log(`Order created with ID: ${order.id}`);

      // 2. Immediately create checkout if paymentMethod is not 'cod'
      let paymentUrl: string | undefined = undefined;
      let checkoutId: string | undefined = undefined;
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

        this.logger.log(
          `Checkout created for order ${order.id}: paymentUrl=${paymentUrl}, checkoutId=${checkoutId}`,
        );
      }

      if (body.paymentMethod === 'cod') {
        // THÊM PUBLISH EVENT KHI STATUS CHUYỂN THÀNH PENDING
        const updatedOrder = await this.orderService.getOrderById(order.id);
        await pubSub.publish('orderCreated', {
          orderCreated: updatedOrder,
        });
        this.logger.log(`Order ${order.id} will be paid on delivery (COD)`);
        paymentUrl = process.env.FRONTEND_URL + `/order/${order.id}`;
      }

      // 3. Return order info and paymentUrl (if any)
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
        temporaryAddress: isTemporaryAddress, // Indicate if a temporary address was used
      };
    } catch (error) {
      // If order creation fails and we created a temporary address, clean it up
      if (isTemporaryAddress && addressId) {
        try {
          await this.orderService.deleteTemporaryAddress(addressId);
          this.logger.log(
            `🗑️ Cleaned up temporary address ${addressId} after order creation failure`,
          );
        } catch (cleanupError: unknown) {
          this.logger.error(
            `❌ Failed to clean up temporary address ${addressId}: ${errorMessage(cleanupError)}`,
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

  @Get()
  @UseGuards(RolesGuard)
  @ApiBearerAuth('bearer')
  @Permissions(Permission.ORDER.READ)
  @ApiOperation({ summary: 'Get all orders in system (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of all orders' })
  @ApiResponse({ status: 403, description: 'Forbidden if actor lacks ORDER.READ capability' })
  getAllOrders() {
    return this.orderService.getAllOrders();
  }

  @Post('calculate')
  @ApiOperation({ summary: 'Calculate order price and shipping fee with a saved address' })
  @ApiResponse({ status: 200, description: 'Order pricing calculation successful' })
  @ApiResponse({ status: 400, description: 'Validation failed or missing required fields' })
  async calculateOrder(@Body() body: CalculateOrderDto) {
    this.logger.log(`Calculating order: ${JSON.stringify(body)}`);

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
    this.logger.log(`Calculating order with custom address: ${JSON.stringify(body)}`);

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

    // Get restaurant owned by this user
    const userRestaurant = await this.restaurantService.findByOwnerId(userId);
    if (!userRestaurant) {
      throw new ForbiddenException('You do not own any restaurant');
    }

    return this.orderService.getOrdersByRestaurant(userRestaurant.id, page, pageSize, status);
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

  @Put(':id/status')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update order status by restaurant owner' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Order status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status or transition' })
  @ApiResponse({ status: 403, description: 'User does not own the restaurant for this order' })
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() body: UpdateOrderStatusDto,
    @CurrentActor() actor: CurrentActorData,
  ) {
    const userId = actor.userId;
    const currentOrder = await this.orderService.getOrderById(id);
    const previousStatus = parseOrderStatus(currentOrder.status);

    this.actorPolicy.assertCanManageRestaurantOrder(currentOrder, userId);

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

    const updatedOrder = await this.orderService.updateOrderStatus(id, status);

    await pubSub.publish('orderStatusUpdated', {
      orderStatusUpdated: updatedOrder,
    });

    if (status === OrderStatus.CONFIRMED && previousStatus !== OrderStatus.CONFIRMED) {
      if (!updatedOrder.shippingDetail) {
        try {
          await this.pendingAssignmentService.addPendingAssignment(id, 1);
          this.logger.log(`Added order ${id} to pending shipper assignments`);
        } catch (error: unknown) {
          this.logger.error(
            `Failed to add order ${id} to pending assignments: ${errorMessage(error)}`,
          );
        }
      } else {
        this.logger.log(
          `Order ${id} already assigned to shipper, not adding to pending assignments`,
        );
      }
    }

    if (previousStatus === OrderStatus.CONFIRMED && status !== OrderStatus.CONFIRMED) {
      try {
        await this.pendingAssignmentService.removePendingAssignment(id);
        this.logger.log(`Removed order ${id} from pending assignments due to status change`);
      } catch (error: unknown) {
        this.logger.error(
          `Failed to remove order ${id} from pending assignments: ${errorMessage(error)}`,
        );
      }
    }

    this.logger.log(
      `Order ${id} status updated to ${status} by restaurant owner ${userId}. User ${updatedOrder.user?.id ?? currentOrder.user?.id ?? 'unknown'} notified.`,
    );

    return updatedOrder;
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
    @Param('id') id: string,
    @Body() body: UpdateOrderStatusDto,
    @CurrentActor() actor: CurrentActorData,
  ) {
    if (!body?.status) {
      throw new BadRequestException('Status is required');
    }

    this.logger.log(`Admin ${actor.userId} updating order ${id} status to ${body.status}`);
    return this.orderService.updateOrderStatus(id, body.status);
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

  @Post('validate-promotion')
  @ApiOperation({ summary: 'Validate promotion eligibility for an order' })
  @ApiResponse({ status: 200, description: 'Promotion validation result' })
  @ApiResponse({ status: 400, description: 'Missing required fields or validation failure' })
  async validatePromotion(@Body() body: ValidatePromotionDto) {
    this.logger.log(`Validating promotion: ${body.promotionCode}`);

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
