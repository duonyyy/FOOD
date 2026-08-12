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
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Permissions } from 'src/auth/decorators/permissions.decorator';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AuthenticatedRequest } from 'src/auth/interfaces/authenticated-request.interface';
import { Permission } from 'src/constants/permission.enum';
import { Order } from 'src/entities/order.entity';
import { PendingAssignmentService } from 'src/infra/queue/pending-assignment.service';
import { PaymentService } from 'src/payment/payment.service';
import { pubSub } from 'src/pubsub'; // THÊM IMPORT NÀY
import { RestaurantProfileService } from '../../features/restaurants/services/restaurant-profile.service';
import { CreateOrderRequestDto } from './dto/create-order-request.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaymentDto } from './dto/payment.dto';
import { OrderService } from './order.service';

@Controller('orders')
@ApiTags('orders')
export class OrderController {
  private readonly logger = new Logger(OrderController.name);

  constructor(
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
    private readonly restaurantService: RestaurantProfileService,
    private readonly pendingAssignmentService: PendingAssignmentService, // Inject the new service
  ) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create an order using server-authoritative pricing' })
  @ApiCreatedResponse({ description: 'Order and optional checkout created' })
  @ApiUnauthorizedResponse({ description: 'JWT is missing or invalid' })
  async createOrder(@Body() body: CreateOrderRequestDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
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
        const checkout = await this.paymentService.createCheckout(order.id, body.paymentMethod);
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
        } catch (cleanupError) {
          this.logger.error(
            `❌ Failed to clean up temporary address ${addressId}: ${cleanupError.message}`,
          );
        }
      }
      throw error;
    }
  }

  @Get('my')
  @UseGuards(AuthGuard)
  async getMyOrders(
    @Req() req,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 10,
    @Query('status') status?: string,
  ) {
    const userId = req.user.uid || req.user.id;
    return this.orderService.getOrdersByUser(userId, page, pageSize, status);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Permissions(Permission.ORDER.READ)
  getAllOrders() {
    return this.orderService.getAllOrders();
  }
  @Post('calculate')
  async calculateOrder(
    @Body()
    body: {
      addressId: string;
      restaurantId: string;
      items: { foodId: string; quantity: number }[];
      promotionCode?: string; // Add promotion code to calculation
    },
  ) {
    this.logger.log(`Calculating order: ${JSON.stringify(body)}`);

    if (
      !body.addressId ||
      !body.restaurantId ||
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      return { error: 'Missing addressId, restaurantId, or items' };
    }

    // Delegate to service with promotion code
    return this.orderService.calculateOrder({
      addressId: body.addressId,
      restaurantId: body.restaurantId,
      items: body.items,
      promotionCode: body.promotionCode,
    });
  }

  @Post('calculate-custom')
  async calculateOrderWithCustomAddress(
    @Body()
    body: {
      address: {
        street: string;
        ward: string;
        district: string;
        city: string;
        latitude: number;
        longitude: number;
        label?: string;
      };
      restaurantId: string;
      items: { foodId: string; quantity: number }[];
      promotionCode?: string;
    },
  ) {
    this.logger.log(`Calculating order with custom address: ${JSON.stringify(body)}`);

    if (
      !body.address ||
      !body.restaurantId ||
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      return { error: 'Missing address, restaurantId, or items' };
    }

    // Gọi đến service xử lý tương ứng
    return this.orderService.calculateOrderWithCustomAddress(
      body.address,
      body.restaurantId,
      body.items,
      body.promotionCode,
    );
  }

  @Get('restaurant/my')
  @UseGuards(AuthGuard)
  async getOrdersByMyRestaurant(
    @Req() req,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 10,
    @Query('status') status?: string,
  ) {
    this.logger.log(`Getting orders for restaurant owned by user: ${req.user.uid || req.user.id}`);
    const userId = req.user.uid || req.user.id;

    // Get restaurant owned by this user
    const userRestaurant = await this.restaurantService.findByOwnerId(userId);
    if (!userRestaurant) {
      throw new ForbiddenException('You do not own any restaurant');
    }

    return this.orderService.getOrdersByRestaurant(userRestaurant.id, page, pageSize, status);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  async getOrderById(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Query('review') review?: boolean,
  ) {
    return this.getOrderForActor(id, req.user.id, review);
  }

  @Get('user/:userId')
  @UseGuards(AuthGuard)
  getOrdersByUser(@Param('userId') userId: string, @Req() req: AuthenticatedRequest) {
    if (userId !== req.user.id) {
      throw new ForbiddenException("You cannot access another user's orders");
    }
    return this.orderService.getOrdersByUser(userId);
  }

  @Get(':id/details')
  @UseGuards(AuthGuard)
  async getOrderDetails(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.getOrderForActor(id, req.user.id);
    return this.orderService.getOrderDetails(id);
  }

  @Put(':id/status')
  @UseGuards(AuthGuard)
  async updateOrderStatus(@Param('id') id: string, @Body('status') status: string, @Req() req) {
    // Get authenticated user
    const userId = req.user.uid || req.user.id;

    // Get order with restaurant details BEFORE update
    const currentOrder = await this.orderService.getOrderById(id);
    const previousStatus = currentOrder.status;

    // Check if user owns the restaurant of this order
    const userRestaurant = await this.restaurantService.findByOwnerId(userId);
    if (!userRestaurant || userRestaurant.id !== currentOrder.restaurant.id) {
      throw new ForbiddenException('You can only update orders for your own restaurant');
    }

    if (!status) {
      throw new BadRequestException('Status is required');
    }

    // Only allow specific status transitions
    const allowedStatuses = [
      'confirmed',
      'delivering',
      'shipper_received',
      'completed',
      'canceled',
    ];
    if (!allowedStatuses.includes(status)) {
      throw new BadRequestException(
        `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`,
      );
    }

    // Update order status
    const updatedOrder = await this.orderService.updateOrderStatus(id, status);

    // PUBLISH EVENT TO NOTIFY USER ABOUT STATUS CHANGE
    await pubSub.publish('orderStatusUpdated', {
      orderStatusUpdated: updatedOrder,
    });

    // ADD ORDER TO PENDING ASSIGNMENTS WHEN STATUS CHANGES TO 'confirmed'
    if (status === 'confirmed' && previousStatus !== 'confirmed') {
      // Only add if order is not already assigned to a shipper
      if (!updatedOrder.shippingDetail) {
        try {
          await this.pendingAssignmentService.addPendingAssignment(id, 1);
          this.logger.log(`Added order ${id} to pending shipper assignments`);
        } catch (error) {
          this.logger.error(`Failed to add order ${id} to pending assignments: ${error.message}`);
        }
      } else {
        this.logger.log(
          `Order ${id} already assigned to shipper, not adding to pending assignments`,
        );
      }
    }

    // REMOVE FROM PENDING ASSIGNMENTS if status changes from 'confirmed' to something else
    if (previousStatus === 'confirmed' && status !== 'confirmed') {
      try {
        await this.pendingAssignmentService.removePendingAssignment(id);
        this.logger.log(`Removed order ${id} from pending assignments due to status change`);
      } catch (error) {
        this.logger.error(
          `Failed to remove order ${id} from pending assignments: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Order ${id} status updated to ${status} by restaurant owner ${userId}. User ${updatedOrder.user.id} notified.`,
    );

    return updatedOrder;
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async deleteOrder(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const order = await this.orderService.getOrderById(id);
    if (order.user?.id !== req.user.id) {
      throw new ForbiddenException('Only the customer who placed the order can delete it');
    }
    return this.orderService.deleteOrder(id);
  }

  @Post(':id/payment')
  @UseGuards(AuthGuard)
  async processPayment(
    @Param('id') id: string,
    @Body() paymentData: PaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const order = await this.orderService.getOrderById(id);
    if (order.user?.id !== req.user.id) {
      throw new ForbiddenException('Only the customer who placed the order can pay for it');
    }
    return this.orderService.processPayment(id, paymentData);
  }

  @Post('validate-promotion')
  async validatePromotion(
    @Body()
    body: {
      promotionCode: string;
      addressId: string;
      restaurantId: string;
      items: { foodId: string; quantity: number }[];
    },
  ) {
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
    includeReviewInfo: boolean = false,
  ): Promise<Order> {
    const order = await this.orderService.getOrderById(orderId, includeReviewInfo);
    const isCustomer = order.user?.id === actorId;
    const isRestaurantOwner = order.restaurant?.owner?.id === actorId;
    const isAssignedShipper = order.shippingDetail?.shipper?.id === actorId;

    if (!isCustomer && !isRestaurantOwner && !isAssignedShipper) {
      throw new ForbiddenException('You cannot access this order');
    }
    return order;
  }
}
