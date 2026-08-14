import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import {
  PAYMENT_SUCCEEDED_EVENT,
  type PaymentSucceededEvent,
} from 'src/common/events/payment-succeeded.event';
import { Checkout, CheckoutStatus } from 'src/entities/checkout.entity';
import {
  assertPaymentStatusTransition,
} from 'src/features/payments/domain/payment-status-machine';
import type { PaymentOrderSnapshot } from 'src/features/payments/contracts/payment-order-snapshot.contract';
import type { PaymentGatewayPort } from 'src/features/payments/contracts/payment-gateway.port';
import { PaymentGatewayRouter } from 'src/infra/payment-gateways/payment-gateway.router';
import { Repository } from 'typeorm';
import {
  type PaymentResult,
} from './interfaces/payment-gateway.interface';
import type { PaymentStatusResponse } from './interfaces/payment-status.interface';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Checkout)
    private readonly checkoutRepository: Repository<Checkout>,
    private readonly configService: ConfigService,
    private readonly paymentGateways: PaymentGatewayRouter,
    private readonly eventBus: InProcessEventBus,
  ) {}

  /**
   * Ordering supplies its already-calculated snapshot. Payments never reads the
   * Order, User, Catalog or Promotion repositories to create a checkout.
   */
  async createCheckout(
    order: PaymentOrderSnapshot,
    paymentMethod: string,
  ): Promise<Checkout> {
    this.assertSnapshot(order);

    const checkout = this.checkoutRepository.create({
      orderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
      paymentMethod,
      status: order.amount === 0 ? CheckoutStatus.COMPLETED : CheckoutStatus.PENDING,
    });
    await this.checkoutRepository.save(checkout);

    if (order.amount === 0) {
      await this.publishSucceeded(checkout);
      return checkout;
    }

    const gateway = this.selectGateway(paymentMethod);
    try {
      const paymentIntent = await gateway.createPaymentIntent(
        order.orderId,
        order.amount,
        order.currency,
        {
          orderId: order.orderId,
          checkoutId: checkout.id,
          redirectUrl: `${this.configService.get<string>('API_URL')}/payment/${paymentMethod}/result`,
          ipnUrl: `${this.configService.get<string>('API_URL')}/payment/webhook`,
        },
      );
      checkout.paymentIntentId = paymentIntent.id;
      await this.checkoutRepository.save(checkout);

      // paymentUrl is intentionally transient: signed provider URLs are secrets.
      return Object.assign(checkout, { paymentUrl: paymentIntent.clientSecret });
    } catch (error) {
      await this.transition(checkout, CheckoutStatus.FAILED);
      const message = this.errorMessage(error);
      this.logger.error(`Failed to create payment intent for checkout ${checkout.id}: ${message}`);
      throw new BadRequestException(`Payment processing failed: ${message}`);
    }
  }

  async processPayment(
    checkoutId: string,
    paymentDetails: Record<string, unknown>,
  ): Promise<PaymentResult> {
    const checkout = await this.checkoutRepository.findOne({ where: { id: checkoutId } });
    if (!checkout) {
      throw new BadRequestException(`Checkout with ID ${checkoutId} not found`);
    }
    this.assertPending(checkout);

    try {
      const result = await this.selectGateway(checkout.paymentMethod).confirmPaymentIntent(
        checkout.paymentIntentId,
      );
      if (result.success) {
        checkout.providerMetadata = sanitizeProviderMetadata(paymentDetails);
        await this.transition(checkout, CheckoutStatus.COMPLETED);
        await this.publishSucceeded(checkout);
      } else {
        await this.transition(checkout, CheckoutStatus.FAILED);
      }
      return result;
    } catch (error) {
      if (checkout.status === CheckoutStatus.PENDING) {
        await this.transition(checkout, CheckoutStatus.FAILED);
      }
      const message = this.errorMessage(error);
      this.logger.error(`Payment processing failed for checkout ${checkout.id}: ${message}`);
      throw new BadRequestException(`Payment processing failed: ${message}`);
    }
  }

  async cancelCheckout(checkoutId: string): Promise<Checkout> {
    const checkout = await this.checkoutRepository.findOne({ where: { id: checkoutId } });
    if (!checkout) {
      throw new BadRequestException(`Checkout with ID ${checkoutId} not found`);
    }
    this.assertPending(checkout);

    if (checkout.paymentIntentId) {
      try {
        await this.selectGateway(checkout.paymentMethod).cancelPaymentIntent(checkout.paymentIntentId);
      } catch (error) {
        this.logger.warn(
          `Provider cancellation failed for checkout ${checkout.id}: ${this.errorMessage(error)}`,
        );
      }
    }
    await this.transition(checkout, CheckoutStatus.CANCELLED);
    return checkout;
  }

  async handleWebhookEvent(payload: object, signature: string): Promise<void> {
    const callback = payload as Record<string, unknown>;
    if (callback.partnerCode !== 'MOMO') {
      throw new BadRequestException(`Unsupported payment gateway: ${String(callback.partnerCode)}`);
    }

    const gateway = this.selectGateway('momo');
    if (!gateway.verifyWebhookSignature(callback, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }
    if (callback.currency && String(callback.currency).toUpperCase() !== 'VND') {
      throw new BadRequestException('Payment currency does not match checkout currency');
    }

    await gateway.handleWebhookEvent(callback);
    const eventType = String(callback.type || 'payment_intent.succeeded');
    const resultCode = callback.resultCode === undefined ? undefined : String(callback.resultCode);
    const isSuccess = eventType === 'payment_intent.succeeded' || resultCode === '0' || resultCode === '9000';
    if (eventType === 'payment_intent.succeeded' && resultCode && resultCode !== '0' && resultCode !== '9000') {
      throw new BadRequestException('Payment callback status is inconsistent');
    }

    const providerReference = String(callback.orderId || '');
    if (!providerReference) {
      throw new BadRequestException('Missing provider payment reference');
    }
    if (isSuccess) {
      await this.handlePaymentSuccess(providerReference, callback.amount as string | number | undefined);
    } else {
      await this.handlePaymentFailure(providerReference);
    }
  }

  public async handlePaymentSuccess(
    paymentIntentId: string,
    callbackAmount?: string | number,
  ): Promise<void> {
    const checkout = await this.checkoutRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Checkout);
      const current = await repository.findOne({
        where: { paymentIntentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!current) {
        throw new BadRequestException(`Checkout with payment intent ${paymentIntentId} not found`);
      }
      if (
        callbackAmount !== undefined &&
        Math.abs(Number(current.amount) - Number(callbackAmount)) > 0.01
      ) {
        throw new BadRequestException('Payment amount does not match checkout snapshot');
      }
      if (current.status === CheckoutStatus.COMPLETED) {
        return null;
      }
      assertPaymentStatusTransition(current.status, CheckoutStatus.COMPLETED);
      current.status = CheckoutStatus.COMPLETED;
      return repository.save(current);
    });

    if (checkout) {
      await this.publishSucceeded(checkout);
    }
  }

  public async handlePaymentFailure(paymentIntentId: string): Promise<void> {
    const checkout = await this.checkoutRepository.findOne({ where: { paymentIntentId } });
    if (!checkout || checkout.status !== CheckoutStatus.PENDING) {
      return;
    }
    await this.transition(checkout, CheckoutStatus.FAILED);
  }

  async handleMomoResult(orderId: string, resultCode: string, message: string): Promise<{ success: boolean; message: string }> {
    const checkout = await this.findCheckoutByOrderId(orderId);
    if (resultCode === '0' || resultCode === '9000') {
      await this.handlePaymentSuccess(checkout.paymentIntentId);
      return { success: true, message: 'Payment successful' };
    }
    await this.handlePaymentFailure(checkout.paymentIntentId);
    return { success: false, message: message || 'Payment failed' };
  }

  async checkMomoStatus(orderId: string): Promise<Record<string, unknown>> {
    const checkout = await this.findCheckoutByOrderId(orderId);
    const paymentIntent = await this.selectGateway('momo').getPaymentIntent(checkout.paymentIntentId);
    return {
      orderId,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    };
  }

  async checkPaymentStatus(
    orderId: string,
    paymentMethod?: string,
  ): Promise<PaymentStatusResponse> {
    const checkout = await this.findCheckoutByOrderId(orderId);
    const method = paymentMethod || checkout.paymentMethod;
    const response: PaymentStatusResponse = {
      orderId,
      status: checkout.status,
      amount: Number(checkout.amount),
      currency: checkout.currency,
      checkoutId: checkout.id,
      checkoutStatus: checkout.status,
      paymentMethod: method,
    };

    if (checkout.paymentIntentId) {
      try {
        const paymentIntent = await this.selectGateway(method).getPaymentIntent(checkout.paymentIntentId);
        response.paymentIntentStatus = paymentIntent.status;
      } catch (error) {
        this.logger.warn(
          `Unable to read provider status for checkout ${checkout.id}: ${this.errorMessage(error)}`,
        );
      }
    }
    return response;
  }

  private async findCheckoutByOrderId(orderId: string): Promise<Checkout> {
    const checkout = await this.checkoutRepository.findOne({ where: { orderId } });
    if (!checkout) {
      throw new BadRequestException(`Checkout for order ${orderId} not found`);
    }
    return checkout;
  }

  private selectGateway(method: string): PaymentGatewayPort {
    if (method !== 'momo' && method !== 'vnpay') {
      throw new BadRequestException(`Unsupported payment method: ${method}`);
    }
    return this.paymentGateways.get(method);
  }

  private async transition(checkout: Checkout, next: CheckoutStatus): Promise<void> {
    assertPaymentStatusTransition(checkout.status, next);
    checkout.status = next;
    await this.checkoutRepository.save(checkout);
  }

  private assertPending(checkout: Checkout): void {
    if (checkout.status !== CheckoutStatus.PENDING) {
      throw new BadRequestException(`Checkout is not pending: ${checkout.status}`);
    }
  }

  private assertSnapshot(snapshot: PaymentOrderSnapshot): void {
    if (!snapshot.orderId || !Number.isFinite(Number(snapshot.amount)) || Number(snapshot.amount) < 0) {
      throw new BadRequestException('Payment requires a valid server-side order amount snapshot');
    }
    if (snapshot.currency !== 'VND') {
      throw new BadRequestException('Only VND payments are currently supported');
    }
  }

  private async publishSucceeded(checkout: Checkout): Promise<void> {
    await this.eventBus.publish<PaymentSucceededEvent>(PAYMENT_SUCCEEDED_EVENT, {
      orderId: checkout.orderId,
      checkoutId: checkout.id,
      paymentId: checkout.paymentIntentId ?? null,
    });
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

const SENSITIVE_METADATA_KEYS = /(?:card|cvv|cvc|token|secret|signature|authorization|password)/i;

function sanitizeProviderMetadata(input: Record<string, unknown>): Record<string, unknown> {
  const metadata = input.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata as Record<string, unknown>).filter(
      ([key, value]) => !SENSITIVE_METADATA_KEYS.test(key) && isSafeMetadataValue(value),
    ),
  );
}

function isSafeMetadataValue(value: unknown): value is string | number | boolean | null {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}
