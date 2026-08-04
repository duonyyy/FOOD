import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Food } from 'src/entities/food.entity';
import { Promotion } from 'src/entities/promotion.entity';
import { User } from 'src/entities/user.entity';
import { MomoPaymentGateway } from 'src/infra/payment-gateways/momo-payment.gateway';
import { VnpayPaymentGateway } from 'src/infra/payment-gateways/vnpay-payment.gateway';
import { OrderService } from 'src/modules/order/order.service';
import { pubSub } from 'src/pubsub';
import { Repository } from 'typeorm';
import { Checkout, CheckoutStatus } from '../entities/checkout.entity';
import { Order } from '../entities/order.entity';
import { OrderDetail } from '../entities/orderDetail.entity';
import {
  IPaymentGateway,
  PaymentGatewayConfig,
  PaymentResult,
} from './interfaces/payment-gateway.interface';
import { PaymentStatusResponse } from './interfaces/payment-status.interface';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private paymentGateway: IPaymentGateway;

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderDetail)
    private orderDetailRepository: Repository<OrderDetail>,
    @InjectRepository(Checkout)
    private checkoutRepository: Repository<Checkout>,
    @InjectRepository(Food)
    private foodRepository: Repository<Food>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Promotion)
    private promotionRepository: Repository<Promotion>,

    private configService: ConfigService,
    private momoPaymentGateway: MomoPaymentGateway,
    private orderService: OrderService,
    private vnpayPaymentGateway: VnpayPaymentGateway,
  ) {}

  /**
   * Set the payment gateway implementation
   */
  setPaymentGateway(gateway: IPaymentGateway) {
    this.paymentGateway = gateway;

    // Initialize the gateway with configuration
    const config: PaymentGatewayConfig = {
      apiKey: this.configService.get<string>('PAYMENT_API_KEY') || '',
      secretKey: this.configService.get<string>('PAYMENT_SECRET_KEY') || '',
      environment: this.configService.get<'sandbox' | 'production'>(
        'PAYMENT_ENVIRONMENT',
        'sandbox',
      ),
      webhookSecret: this.configService.get<string>('PAYMENT_WEBHOOK_SECRET'),
    };

    this.paymentGateway.initialize(config);
  }

  /**
   * Create a checkout session for an order, or auto-complete if order is free
   * @param orderId Order ID to create checkout for
   * @param paymentMethod Payment method (only used for paid orders)
   * @returns Checkout record (completed immediately for free orders)
   */
  async createCheckout(orderId: string, paymentMethod: string): Promise<Checkout> {
    // Get the order with details including promotion
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['orderDetails', 'user', 'orderDetails.food', 'promotionCode'],
    });

    if (!order) {
      throw new BadRequestException(`Order with ID ${orderId} not found`);
    }

    // Handle free orders (price = 0) differently
    if (order.total === 0) {
      this.logger.log(`Order ${orderId} has zero price - processing as free order`);
      const checkout = this.checkoutRepository.create({
        user: order.user,
        amount: 0,
        paymentMethod: 'free',
        status: CheckoutStatus.COMPLETED,
        orderId: orderId,
      });
      await this.checkoutRepository.save(checkout);

      // Update order status to completed
      order.status = 'completed';
      await this.orderRepository.save(order);

      // Update food purchase count
      await this.updateFoodPurchaseCount(orderId);

      this.logger.log(`Free order ${orderId} processed automatically without payment`);
      return checkout;
    }

    // Regular flow for paid orders
    const checkout = this.checkoutRepository.create({
      user: order.user,
      amount: order.total,
      paymentMethod,
      status: CheckoutStatus.PENDING,
      orderId: orderId,
    });

    await this.checkoutRepository.save(checkout);

    // Include promotion information in metadata
    const promotionMetadata = order.promotionCode
      ? {
          promotionId: order.promotionCode.id,
          promotionCode: order.promotionCode.code,
          promotionType: order.promotionCode.type,
        }
      : {};

    if (paymentMethod === 'momo') {
      this.setPaymentGateway(this.momoPaymentGateway);
    } else if (paymentMethod === 'vnpay') {
      this.setPaymentGateway(this.vnpayPaymentGateway);
    } else {
      throw new BadRequestException(`Unsupported payment method: ${paymentMethod}`);
    }

    switch (paymentMethod) {
      case 'momo':
        try {
          const paymentIntent = await this.paymentGateway.createPaymentIntent(
            orderId,
            order.total,
            'VND', // Default currency for Momo
            {
              orderId,
              checkoutId: checkout.id,
              userId: order.user.id,
              redirectUrl: `${this.configService.get<string>('API_URL')}/payment/momo/result`,
              ipnUrl: `${this.configService.get<string>('API_URL')}/payment/webhook`,
              ...promotionMetadata, // Include promotion data
            },
          );

          // Update checkout with payment intent ID
          checkout.paymentIntentId = paymentIntent.id;
          await this.checkoutRepository.save(checkout);

          // For Momo, we need to return the payment URL
          if (paymentMethod === 'momo' && paymentIntent.clientSecret) {
            return {
              ...checkout,
              paymentUrl: paymentIntent.clientSecret,
            };
          }

          return checkout;
        } catch (error) {
          this.logger.error(`Failed to create payment intent: ${error.message}`);
          checkout.status = CheckoutStatus.FAILED;
          await this.checkoutRepository.save(checkout);
          throw new BadRequestException(`Payment processing failed: ${error.message}`);
        }
        break;
      case 'vnpay':
        try {
          const paymentIntent = await this.paymentGateway.createPaymentIntent(
            orderId,
            order.total,
            'VND', // Default currency for VNPAY
            {
              orderId,
              checkoutId: checkout.id,
              userId: order.user.id,
              redirectUrl: `${this.configService.get<string>('VNPAY_URL')}`,
              ipnUrl: `${this.configService.get<string>('API_URL')}/payment/webhook`,
              ...promotionMetadata, // Include promotion data
            },
          );

          // Update checkout with payment intent ID
          checkout.paymentIntentId = paymentIntent.id;
          await this.checkoutRepository.save(checkout);

          // For VNPAY, we need to return the payment URL
          if (paymentMethod === 'vnpay' && paymentIntent.clientSecret) {
            return {
              ...checkout,
              paymentUrl: paymentIntent.clientSecret,
            };
          }

          return checkout;
        } catch (error) {
          this.logger.error(`Failed to create payment intent: ${error.message}`);
          checkout.status = CheckoutStatus.FAILED;
          await this.checkoutRepository.save(checkout);
          throw new BadRequestException(`Payment processing failed: ${error.message}`);
        }
        break;
      default:
        throw new BadRequestException(`Unsupported payment method: ${String(paymentMethod)}`);
    }
  }

  /**
   * Process a payment for a checkout
   */
  async processPayment(
    checkoutId: string,
    paymentDetails: Record<string, any>,
  ): Promise<PaymentResult> {
    const checkout = await this.checkoutRepository.findOne({
      where: { id: checkoutId },
      relations: ['user', 'food'],
    });

    if (!checkout) {
      throw new BadRequestException(`Checkout with ID ${checkoutId} not found`);
    }

    if (checkout.status !== CheckoutStatus.PENDING) {
      throw new BadRequestException(`Checkout is not in pending status: ${checkout.status}`);
    }

    try {
      // Set the appropriate payment gateway based on the payment method
      if (checkout.paymentMethod === 'momo') {
        this.setPaymentGateway(this.momoPaymentGateway);
      } else if (checkout.paymentMethod === 'vnpay') {
        this.setPaymentGateway(this.vnpayPaymentGateway);
      } else {
        throw new BadRequestException(`Unsupported payment method: ${checkout.paymentMethod}`);
      }

      // Confirm the payment intent
      const result = await this.paymentGateway.confirmPaymentIntent(checkout.paymentIntentId);

      if (result.success) {
        // Update checkout status
        checkout.status = CheckoutStatus.COMPLETED;
        checkout.paymentDetails = paymentDetails;
        await this.checkoutRepository.save(checkout);

        // Update order status
        const order = await this.orderRepository.findOne({
          where: { id: checkout.orderId },
        });

        if (order) {
          // Update order status to pending if payment method is COD
          await this.orderService.updateOrderStatus(order.id, 'pending');

          // THÊM PUBLISH EVENT KHI STATUS CHUYỂN THÀNH PENDING
          const updatedOrder = await this.orderService.getOrderById(order.id);
          await pubSub.publish('orderCreated', {
            orderCreated: updatedOrder,
          });
          this.logger.log(`Published orderCreated event for order ${order.id} with status pending`);
          await this.orderRepository.save(order);
        }

        // Update food purchase count
        await this.updateFoodPurchaseCount(checkout.orderId);

        return result;
      } else {
        // Update checkout status to failed
        checkout.status = CheckoutStatus.FAILED;
        await this.checkoutRepository.save(checkout);
        return result;
      }
    } catch (error) {
      this.logger.error(`Payment processing failed: ${error.message}`);
      checkout.status = CheckoutStatus.FAILED;
      await this.checkoutRepository.save(checkout);
      throw new BadRequestException(`Payment processing failed: ${error.message}`);
    }
  }

  /**
   * Cancel a checkout
   */
  async cancelCheckout(checkoutId: string): Promise<Checkout> {
    const checkout = await this.checkoutRepository.findOne({ where: { id: checkoutId } });

    if (!checkout) {
      throw new BadRequestException(`Checkout with ID ${checkoutId} not found`);
    }

    if (checkout.status !== CheckoutStatus.PENDING) {
      throw new BadRequestException(`Checkout is not in pending status: ${checkout.status}`);
    }

    // Set the appropriate payment gateway based on the payment method
    if (checkout.paymentMethod === 'momo') {
      this.setPaymentGateway(this.momoPaymentGateway);
    } else {
      throw new BadRequestException(`Unsupported payment method: ${checkout.paymentMethod}`);
    }

    // Cancel the payment intent if it exists
    if (checkout.paymentIntentId) {
      try {
        await this.paymentGateway.cancelPaymentIntent(checkout.paymentIntentId);
      } catch (error) {
        this.logger.error(`Failed to cancel payment intent: ${error.message}`);
      }
    }

    // Update checkout status
    checkout.status = CheckoutStatus.CANCELLED;
    await this.checkoutRepository.save(checkout);

    // Update order status
    const order = await this.orderRepository.findOne({ where: { id: checkout.orderId } });
    if (order) {
      order.status = 'canceled';
      await this.orderRepository.save(order);
    }
    return checkout;
  }

  /**
   * Handle webhook events from the payment gateway
   */
  async handleWebhookEvent(payload: any, signature: string): Promise<void> {
    // Set the appropriate payment gateway based on the payload
    if (payload.partnerCode === 'MOMO') {
      this.setPaymentGateway(this.momoPaymentGateway);
    } else {
      throw new BadRequestException(`Unsupported payment gateway: ${payload.partnerCode}`);
    }

    // Verify the webhook signature
    if (!this.paymentGateway.verifyWebhookSignature(payload, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    if (payload.currency && String(payload.currency).toUpperCase() !== 'VND') {
      throw new BadRequestException('Payment currency does not match checkout currency');
    }

    // Process the webhook event
    await this.paymentGateway.handleWebhookEvent(payload);

    // Handle specific events
    const eventType = payload.type || 'payment_intent.succeeded';

    const hasResultCode = payload.resultCode !== undefined && payload.resultCode !== null;
    const hasSuccessfulResultCode = payload.resultCode === '0' || payload.resultCode === '9000';
    const isSuccessEvent = eventType === 'payment_intent.succeeded' || hasSuccessfulResultCode;

    if (eventType === 'payment_intent.succeeded' && hasResultCode && !hasSuccessfulResultCode) {
      throw new BadRequestException('Payment callback status is inconsistent');
    }

    if (isSuccessEvent) {
      const paymentIntentId = payload.orderId;
      await this.handlePaymentSuccess(paymentIntentId, payload.amount);
    } else if (eventType === 'payment_intent.payment_failed' || payload.resultCode !== '0') {
      const paymentIntentId = payload.orderId;
      await this.handlePaymentFailure(paymentIntentId);
    }
  }

  /**
   * Handle successful payment
   */
  public async handlePaymentSuccess(
    paymentIntentId: string,
    callbackAmount?: string | number,
  ): Promise<void> {
    const completion = await this.checkoutRepository.manager.transaction(async (manager) => {
      const checkoutRepository = manager.getRepository(Checkout);
      const orderRepository = manager.getRepository(Order);
      const checkout = await checkoutRepository.findOne({
        where: { paymentIntentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!checkout) {
        throw new BadRequestException(`Checkout with payment intent ${paymentIntentId} not found`);
      }

      if (
        callbackAmount !== undefined &&
        Math.abs(Number(checkout.amount) - Number(callbackAmount)) > 0.01
      ) {
        throw new BadRequestException('Payment amount does not match checkout amount');
      }

      if (checkout.status === CheckoutStatus.COMPLETED) {
        return null;
      }
      if (checkout.status !== CheckoutStatus.PENDING) {
        throw new BadRequestException(`Checkout is not pending: ${checkout.status}`);
      }

      const order = await orderRepository.findOne({
        where: { id: checkout.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        throw new BadRequestException(`Order with ID ${checkout.orderId} not found`);
      }
      if (
        callbackAmount !== undefined &&
        Math.abs(Number(order.total) - Number(callbackAmount)) > 0.01
      ) {
        throw new BadRequestException('Payment amount does not match order total');
      }

      checkout.status = CheckoutStatus.COMPLETED;
      await checkoutRepository.save(checkout);

      order.status = 'completed';
      order.isPaid = true;
      order.paymentDate = new Date().toISOString();
      await orderRepository.save(order);
      return { checkout, order };
    });

    if (!completion) {
      return;
    }

    await this.updateFoodPurchaseCount(completion.checkout.orderId);
    await pubSub.publish('orderCreated', { orderCreated: completion.order });
    await pubSub.publish('orderStatusUpdated', { orderStatusUpdated: completion.order });
  }

  /**
   * Handle failed payment
   */
  public async handlePaymentFailure(paymentIntentId: string): Promise<void> {
    // Find the checkout with this payment intent ID
    const checkout = await this.checkoutRepository.findOne({
      where: { paymentIntentId },
    });

    if (checkout) {
      // Update checkout status
      checkout.status = CheckoutStatus.FAILED;
      await this.checkoutRepository.save(checkout);

      // Update order status
      const order = await this.orderRepository.findOne({
        where: { id: checkout.orderId },
      });
      if (order) {
        order.status = 'canceled'; // or 'failed'
        await this.orderRepository.save(order);
      }
    }
  }

  /**
   * Handle Momo payment result
   */
  async handleMomoResult(orderId: string, resultCode: string, message: string): Promise<any> {
    // Set the Momo payment gateway
    this.setPaymentGateway(this.momoPaymentGateway);

    // Find the checkout with this order ID
    const checkout = await this.checkoutRepository.findOne({
      where: { orderId },
    });

    if (!checkout) {
      throw new BadRequestException(`Checkout with order ID ${orderId} not found`);
    }

    // Process the result
    if (resultCode === '0' || resultCode === '9000') {
      await this.handlePaymentSuccess(checkout.paymentIntentId);
      return {
        success: true,
        message: 'Payment successful',
      };
    } else {
      await this.handlePaymentFailure(checkout.paymentIntentId);
      return {
        success: false,
        message: message || 'Payment failed',
      };
    }
  }

  /**
   * Check Momo payment status
   */
  async checkMomoStatus(orderId: string): Promise<any> {
    // Set the Momo payment gateway
    this.setPaymentGateway(this.momoPaymentGateway);

    // Find the checkout with this order ID
    const checkout = await this.checkoutRepository.findOne({
      where: { orderId },
    });

    if (!checkout) {
      throw new BadRequestException(`Checkout with order ID ${orderId} not found`);
    }

    // Get the payment intent
    const paymentIntent = await this.paymentGateway.getPaymentIntent(checkout.paymentIntentId);

    return {
      orderId,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    };
  }

  /**
   * Check payment status for an order
   * @param orderId Order ID
   * @param paymentMethod Payment method (optional)
   * @returns Payment status information
   */
  async checkPaymentStatus(
    orderId: string,
    paymentMethod?: string,
  ): Promise<PaymentStatusResponse> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user'],
    });

    if (!order) {
      throw new BadRequestException(`Order with ID ${orderId} not found`);
    }

    // Find the checkout for this order
    const checkout = await this.checkoutRepository.findOne({
      where: { orderId },
    });

    if (!checkout) {
      throw new BadRequestException(`Checkout for order ${orderId} not found`);
    }

    // Set payment gateway based on checkout or provided method
    const method = paymentMethod || checkout.paymentMethod;
    if (method === 'momo') {
      this.setPaymentGateway(this.momoPaymentGateway);
    } else if (method === 'vnpay') {
      this.setPaymentGateway(this.vnpayPaymentGateway);
    } else {
      throw new BadRequestException(`Unsupported payment method: ${method}`);
    }

    // Create base response
    const response: PaymentStatusResponse = {
      orderId,
      status: order.status,
      amount: order.total,
      currency: 'VND',
      checkoutId: checkout.id,
      checkoutStatus: checkout.status,
      paymentMethod: method,
    };

    // Fetch additional payment intent details if available
    if (checkout.paymentIntentId) {
      try {
        const paymentIntent = await this.paymentGateway.getPaymentIntent(checkout.paymentIntentId);
        response.paymentIntentStatus = paymentIntent.status;
        response.metadata = paymentIntent.metadata;
      } catch (error) {
        this.logger.error(
          `Failed to get payment intent for ${checkout.paymentIntentId}: ${error.message}`,
        );
      }
    }

    return response;
  }

  /**
   * Update purchase count for food items in an order
   * @param orderId Order ID for completed payment
   */
  private async updateFoodPurchaseCount(orderId: string): Promise<void> {
    try {
      // Find the order with details and related foods
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
        relations: ['orderDetails', 'orderDetails.food'],
      });

      if (!order) {
        this.logger.warn(`Cannot update food purchase count: Order ${orderId} not found`);
        return;
      }

      // Update purchase count for each food item
      for (const detail of order.orderDetails) {
        if (detail.food) {
          // Parse quantity and increment the purchasedNumber
          const quantity = detail.quantity || 1;

          // Update food purchase count
          detail.food.purchasedNumber = (detail.food.purchasedNumber || 0) + quantity;
          detail.food.soldCount = (detail.food.soldCount || 0) + quantity;

          await this.foodRepository.save(detail.food);

          this.logger.log(
            `Updated purchase count for food ${detail.food.id}, new count: ${detail.food.purchasedNumber}`,
          );
        }
      }

      this.logger.log(`Food purchase counts updated for order ${orderId}`);
    } catch (error) {
      this.logger.error(`Failed to update food purchase count: ${error.message}`, error.stack);
    }
  }
}
