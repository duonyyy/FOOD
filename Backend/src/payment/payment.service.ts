import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxService } from 'src/common/events/outbox.service';
import {
  PAYMENT_FAILED_EVENT,
  type PaymentFailedEvent,
} from 'src/common/events/payment-failed.event';
import {
  PAYMENT_SUCCEEDED_EVENT,
  type PaymentSucceededEvent,
} from 'src/common/events/payment-succeeded.event';
import { Checkout, CheckoutStatus } from 'src/entities/checkout.entity';
import type {
  PaymentGatewayPort,
  PaymentIntent,
} from 'src/features/payments/contracts/payment-gateway.port';
import { PaymentStatus } from 'src/features/payments/contracts/payment-gateway.port';
import type { PaymentOrderSnapshot } from 'src/features/payments/contracts/payment-order-snapshot.contract';
import type {
  PaymentWebhookAcknowledgement,
  VerifiedPaymentOutcome,
} from 'src/features/payments/contracts/payment-webhook.contract';
import { assertPaymentStatusTransition } from 'src/features/payments/domain/payment-status-machine';
import { PaymentGatewayRouter } from 'src/infra/payment-gateways/payment-gateway.router';
import { Repository } from 'typeorm';
import { type PaymentResult } from './interfaces/payment-gateway.interface';
import type { PaymentStatusResponse } from './interfaces/payment-status.interface';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Checkout)
    private readonly checkoutRepository: Repository<Checkout>,
    private readonly configService: ConfigService,
    private readonly paymentGateways: PaymentGatewayRouter,
    private readonly outboxService: OutboxService,
  ) {}

  /**
   * Ordering supplies its already-calculated snapshot. Payments never reads the
   * Order, User, Catalog or Promotion repositories to create a checkout.
   */
  async createCheckout(order: PaymentOrderSnapshot, paymentMethod: string): Promise<Checkout> {
    this.assertSnapshot(order);

    const checkout = this.checkoutRepository.create({
      orderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
      paymentMethod,
      status: order.amount === 0 ? CheckoutStatus.COMPLETED : CheckoutStatus.PENDING,
    });
    if (order.amount === 0) {
      const eventId = await this.persistPaymentEvent(checkout, 'succeeded');
      await this.dispatchPaymentEvent(eventId);
      return checkout;
    }

    await this.checkoutRepository.save(checkout);

    const gateway = this.selectGateway(paymentMethod);
    try {
      const paymentIntent = await gateway.createPaymentIntent(
        checkout.id,
        order.amount,
        order.currency,
        {
          orderId: order.orderId,
          providerReference: checkout.id,
          orderInfo: order.orderId,
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
      await this.transition(checkout, CheckoutStatus.FAILED, this.errorMessage(error));
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
        // Redirect providers confirm payment asynchronously. Only a verified
        // provider callback may transition a checkout to COMPLETED.
        await this.checkoutRepository.save(checkout);
      } else {
        await this.transition(checkout, CheckoutStatus.FAILED, 'Provider rejected payment');
      }
      return result;
    } catch (error) {
      if (checkout.status === CheckoutStatus.PENDING) {
        await this.transition(checkout, CheckoutStatus.FAILED, this.errorMessage(error));
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
        await this.selectGateway(checkout.paymentMethod).cancelPaymentIntent(
          checkout.paymentIntentId,
        );
      } catch (error) {
        this.logger.warn(
          `Provider cancellation failed for checkout ${checkout.id}: ${this.errorMessage(error)}`,
        );
      }
    }
    await this.transition(checkout, CheckoutStatus.CANCELLED);
    return checkout;
  }

  async handleWebhookEvent(
    payload: object,
    signature: string,
  ): Promise<PaymentWebhookAcknowledgement> {
    const callback = payload as Record<string, unknown>;
    if (callback.partnerCode !== 'MOMO') {
      throw new BadRequestException(`Unsupported payment gateway: ${String(callback.partnerCode)}`);
    }

    const gateway = this.selectGateway('momo');
    if (!gateway.verifyWebhookSignature(callback, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }
    await gateway.handleWebhookEvent(callback);
    const eventType = callbackString(callback.type) || 'payment_intent.succeeded';
    const resultCode =
      callback.resultCode === undefined ? undefined : callbackString(callback.resultCode);
    const isSuccess =
      eventType === 'payment_intent.succeeded' || resultCode === '0' || resultCode === '9000';
    if (
      eventType === 'payment_intent.succeeded' &&
      resultCode &&
      resultCode !== '0' &&
      resultCode !== '9000'
    ) {
      throw new BadRequestException('Payment callback status is inconsistent');
    }
    return this.applyVerifiedCallback({
      paymentMethod: 'momo',
      providerReference: this.requiredCallbackString(
        callback.orderId,
        'provider payment reference',
      ),
      orderReference: this.requiredCallbackString(callback.orderInfo, 'order reference'),
      providerTransactionId: this.requiredCallbackString(
        callback.transId,
        'provider transaction id',
      ),
      idempotencyKey: `momo:${this.requiredCallbackString(callback.transId, 'provider transaction id')}`,
      amount: this.callbackAmount(callback.amount),
      currency: this.callbackCurrency(callback.currency),
      outcome: isSuccess ? 'succeeded' : 'failed',
    });
  }

  async handleVnpayWebhook(query: Record<string, string>): Promise<PaymentWebhookAcknowledgement> {
    const signature = query.vnp_SecureHash;
    if (!signature) {
      throw new BadRequestException('Missing VNPAY signature');
    }
    const signedPayload = { ...query };
    delete signedPayload.vnp_SecureHash;
    delete signedPayload.vnp_SecureHashType;
    const gateway = this.selectGateway('vnpay');
    if (!gateway.verifyWebhookSignature(signedPayload, signature)) {
      throw new BadRequestException('Invalid VNPAY signature');
    }
    await gateway.handleWebhookEvent(signedPayload);

    const responseCode = query.vnp_ResponseCode;
    const transactionStatus = query.vnp_TransactionStatus;
    return this.applyVerifiedCallback({
      paymentMethod: 'vnpay',
      providerReference: this.requiredCallbackString(
        query.vnp_TxnRef,
        'provider payment reference',
      ),
      orderReference: this.requiredCallbackString(query.vnp_OrderInfo, 'order reference'),
      providerTransactionId: this.requiredCallbackString(
        query.vnp_TransactionNo,
        'provider transaction id',
      ),
      idempotencyKey: `vnpay:${this.requiredCallbackString(
        query.vnp_TransactionNo,
        'provider transaction id',
      )}`,
      amount: this.callbackAmount(Number(query.vnp_Amount) / 100),
      currency: this.callbackCurrency(query.vnp_CurrCode),
      outcome: responseCode === '00' && transactionStatus === '00' ? 'succeeded' : 'failed',
    });
  }

  async handleMomoResult(
    orderId: string,
    _resultCode: string,
    message: string,
  ): Promise<{ success: boolean; message: string }> {
    // Browser redirects are not authoritative: provider webhooks are the only
    // callback path permitted to mutate a checkout.
    this.logger.log(`Received non-authoritative MoMo redirect for reference ${orderId}`);
    return {
      success: false,
      message: message || 'Awaiting verified payment callback',
    };
  }

  async checkMomoStatus(orderId: string): Promise<Record<string, unknown>> {
    const checkout = await this.findCheckoutByOrderId(orderId);
    const paymentIntent = await this.selectGateway('momo').getPaymentIntent(
      checkout.paymentIntentId,
    );
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
        const paymentIntent = await this.selectGateway(method).getPaymentIntent(
          checkout.paymentIntentId,
        );
        response.paymentIntentStatus = paymentIntent.status;
      } catch (error) {
        this.logger.warn(
          `Unable to read provider status for checkout ${checkout.id}: ${this.errorMessage(error)}`,
        );
      }
    }
    return response;
  }

  /**
   * Reconcile one pending checkout from an authoritative provider status query.
   * A provider status alone is not enough: amount, currency, order reference
   * and provider transaction id must all be present and match the checkout
   * snapshot before the normal verified-callback transaction is reused.
   */
  async reconcilePendingCheckout(checkoutId: string): Promise<PaymentReconciliationResult> {
    const checkout = await this.checkoutRepository.findOne({ where: { id: checkoutId } });
    if (!checkout || checkout.status !== CheckoutStatus.PENDING || !checkout.paymentIntentId) {
      return { status: 'skipped' };
    }

    const paymentIntent = await this.selectGateway(checkout.paymentMethod).getPaymentIntent(
      checkout.paymentIntentId,
    );
    if (paymentIntent.status !== PaymentStatus.SUCCEEDED) {
      return { status: 'still_pending', providerStatus: paymentIntent.status };
    }

    const validation = this.validateReconciliationEvidence(checkout, paymentIntent);
    if (!validation.valid) {
      this.logger.warn(
        JSON.stringify({
          event: 'payment_reconciliation_mismatch',
          checkoutId: checkout.id,
          paymentIntentId: checkout.paymentIntentId,
          reason: validation.reason,
        }),
      );
      return { status: 'mismatch', reason: validation.reason };
    }

    const acknowledgement = await this.applyVerifiedCallback({
      paymentMethod: checkout.paymentMethod as 'momo' | 'vnpay',
      providerReference: checkout.paymentIntentId,
      orderReference: validation.orderReference,
      providerTransactionId: validation.providerTransactionId,
      idempotencyKey: `reconciliation:${checkout.paymentMethod}:${validation.providerTransactionId}`,
      amount: validation.amount,
      currency: validation.currency,
      outcome: 'succeeded',
    });

    return {
      status: acknowledgement.duplicate ? 'already_completed' : 'reconciled',
      providerTransactionId: validation.providerTransactionId,
    };
  }

  private async findCheckoutByOrderId(orderId: string): Promise<Checkout> {
    const checkout = await this.checkoutRepository.findOne({ where: { orderId } });
    if (!checkout) {
      throw new BadRequestException(`Checkout for order ${orderId} not found`);
    }
    return checkout;
  }

  private validateReconciliationEvidence(
    checkout: Checkout,
    paymentIntent: PaymentIntent,
  ): ReconciliationEvidence | { valid: false; reason: string } {
    if (paymentIntent.id !== checkout.paymentIntentId) {
      return { valid: false, reason: 'provider_reference_mismatch' };
    }

    const amount = Number(paymentIntent.amount);
    if (!Number.isFinite(amount) || Math.abs(Number(checkout.amount) - amount) > 0.01) {
      return { valid: false, reason: 'amount_mismatch_or_missing' };
    }

    const currency = paymentIntent.currency?.trim().toUpperCase();
    if (!currency || currency !== checkout.currency.toUpperCase()) {
      return { valid: false, reason: 'currency_mismatch_or_missing' };
    }

    const orderReference = paymentIntent.metadata?.orderId;
    if (typeof orderReference !== 'string' || orderReference !== checkout.orderId) {
      return { valid: false, reason: 'order_reference_mismatch_or_missing' };
    }

    const providerTransactionId = paymentIntent.providerTransactionId?.trim();
    if (!providerTransactionId) {
      return { valid: false, reason: 'provider_transaction_id_missing' };
    }

    return {
      valid: true,
      amount,
      currency,
      orderReference,
      providerTransactionId,
    };
  }

  private async applyVerifiedCallback(
    callback: VerifiedPaymentCallback,
  ): Promise<PaymentWebhookAcknowledgement> {
    const persisted = await this.checkoutRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Checkout);
      const checkout = await repository.findOne({
        where: { paymentIntentId: callback.providerReference },
        lock: { mode: 'pessimistic_write' },
      });
      if (!checkout) {
        throw new BadRequestException(
          `Checkout with provider reference ${callback.providerReference} not found`,
        );
      }
      if (checkout.paymentMethod !== callback.paymentMethod) {
        throw new BadRequestException('Provider does not match checkout payment method');
      }
      if (!checkout.orderId) {
        throw new BadRequestException('Checkout has no internal order reference');
      }
      if (checkout.orderId !== callback.orderReference) {
        throw new BadRequestException('Payment order reference does not match checkout');
      }
      if (Math.abs(Number(checkout.amount) - callback.amount) > 0.01) {
        throw new BadRequestException('Payment amount does not match checkout snapshot');
      }
      if (checkout.currency.toUpperCase() !== callback.currency) {
        throw new BadRequestException('Payment currency does not match checkout snapshot');
      }

      if (
        checkout.providerTransactionId === callback.providerTransactionId ||
        checkout.webhookIdempotencyKey === callback.idempotencyKey
      ) {
        return {
          checkout: null,
          duplicate: true,
          outcome: this.outcomeFor(checkout.status),
          eventId: null,
        };
      }
      if (checkout.providerTransactionId || checkout.webhookIdempotencyKey) {
        throw new BadRequestException(
          'Checkout already has a different verified provider callback',
        );
      }
      if (checkout.status !== CheckoutStatus.PENDING) {
        return {
          checkout: null,
          duplicate: true,
          outcome: this.outcomeFor(checkout.status),
          eventId: null,
        };
      }

      const nextStatus =
        callback.outcome === 'succeeded' ? CheckoutStatus.COMPLETED : CheckoutStatus.FAILED;
      assertPaymentStatusTransition(checkout.status, nextStatus);
      checkout.status = nextStatus;
      checkout.providerTransactionId = callback.providerTransactionId;
      checkout.webhookIdempotencyKey = callback.idempotencyKey;
      const saved = await repository.save(checkout);
      const outboxEvent = await this.outboxService.enqueue(manager, {
        eventType:
          callback.outcome === 'succeeded' ? PAYMENT_SUCCEEDED_EVENT : PAYMENT_FAILED_EVENT,
        aggregateType: 'Checkout',
        aggregateId: saved.id,
        idempotencyKey: `Checkout:${saved.id}:payment:${callback.outcome}`,
        payload: this.paymentEventPayload(saved, callback.outcome),
      });
      return {
        checkout: saved,
        duplicate: false,
        outcome: callback.outcome,
        eventId: outboxEvent.id,
      };
    });

    if (persisted.eventId) {
      await this.dispatchPaymentEvent(persisted.eventId);
    }
    return {
      acknowledged: true,
      duplicate: persisted.duplicate,
      outcome: persisted.outcome,
    };
  }

  private outcomeFor(status: CheckoutStatus): VerifiedPaymentOutcome {
    if (status === CheckoutStatus.COMPLETED) {
      return 'succeeded';
    }
    if (status === CheckoutStatus.FAILED) {
      return 'failed';
    }
    throw new BadRequestException(`Checkout cannot acknowledge callback in ${status} state`);
  }

  private requiredCallbackString(value: unknown, label: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`Missing ${label}`);
    }
    return value.trim();
  }

  private callbackAmount(value: unknown): number {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('Invalid provider payment amount');
    }
    return amount;
  }

  private callbackCurrency(value: unknown): string {
    const currency = typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : 'VND';
    if (currency.length !== 3) {
      throw new BadRequestException('Invalid provider payment currency');
    }
    return currency;
  }

  private selectGateway(method: string): PaymentGatewayPort {
    if (method !== 'momo' && method !== 'vnpay') {
      throw new BadRequestException(`Unsupported payment method: ${method}`);
    }
    return this.paymentGateways.get(method);
  }

  private async transition(
    checkout: Checkout,
    next: CheckoutStatus,
    failureReason?: string,
  ): Promise<void> {
    if (next !== CheckoutStatus.FAILED) {
      assertPaymentStatusTransition(checkout.status, next);
      checkout.status = next;
      await this.checkoutRepository.save(checkout);
      return;
    }

    const persisted = await this.checkoutRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Checkout);
      const current = await repository.findOne({
        where: { id: checkout.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!current) throw new BadRequestException(`Checkout with ID ${checkout.id} not found`);
      if (current.status === CheckoutStatus.FAILED) return { checkout: current, eventId: null };
      assertPaymentStatusTransition(current.status, next);
      current.status = next;
      const saved = await repository.save(current);
      const outboxEvent = await this.outboxService.enqueue(manager, {
        eventType: PAYMENT_FAILED_EVENT,
        aggregateType: 'Checkout',
        aggregateId: saved.id,
        idempotencyKey: `Checkout:${saved.id}:payment:failed`,
        payload: this.paymentEventPayload(saved, 'failed', failureReason),
      });
      return { checkout: saved, eventId: outboxEvent.id };
    });

    Object.assign(checkout, persisted.checkout);
    if (persisted.eventId) await this.dispatchPaymentEvent(persisted.eventId);
  }

  private assertPending(checkout: Checkout): void {
    if (checkout.status !== CheckoutStatus.PENDING) {
      throw new BadRequestException(`Checkout is not pending: ${checkout.status}`);
    }
  }

  private assertSnapshot(snapshot: PaymentOrderSnapshot): void {
    if (
      !snapshot.orderId ||
      !Number.isFinite(Number(snapshot.amount)) ||
      Number(snapshot.amount) < 0
    ) {
      throw new BadRequestException('Payment requires a valid server-side order amount snapshot');
    }
    if (snapshot.currency !== 'VND') {
      throw new BadRequestException('Only VND payments are currently supported');
    }
  }

  private async persistPaymentEvent(
    checkout: Checkout,
    outcome: VerifiedPaymentOutcome,
    reason?: string,
  ): Promise<string> {
    const persisted = await this.checkoutRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Checkout);
      const saved = await repository.save(checkout);
      const outboxEvent = await this.outboxService.enqueue(manager, {
        eventType: outcome === 'succeeded' ? PAYMENT_SUCCEEDED_EVENT : PAYMENT_FAILED_EVENT,
        aggregateType: 'Checkout',
        aggregateId: saved.id,
        idempotencyKey: `Checkout:${saved.id}:payment:${outcome}`,
        payload: this.paymentEventPayload(saved, outcome, reason),
      });
      return { checkout: saved, eventId: outboxEvent.id };
    });
    Object.assign(checkout, persisted.checkout);
    return persisted.eventId;
  }

  private paymentEventPayload(
    checkout: Checkout,
    outcome: VerifiedPaymentOutcome,
    reason?: string,
  ): PaymentSucceededEvent | PaymentFailedEvent {
    const payload = {
      orderId: checkout.orderId,
      checkoutId: checkout.id,
      paymentId: checkout.paymentIntentId ?? null,
    };
    return outcome === 'succeeded' ? payload : { ...payload, reason };
  }

  private async dispatchPaymentEvent(eventId: string): Promise<void> {
    try {
      await this.outboxService.dispatchAfterCommit(eventId);
    } catch (error) {
      // The checkout transaction is already committed. The outbox retry job owns recovery.
      this.logger.warn(`Payment event ${eventId} queued for retry: ${this.errorMessage(error)}`);
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

const SENSITIVE_METADATA_KEYS = /(?:card|cvv|cvc|token|secret|signature|authorization|password)/i;

function callbackString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return '';
}

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

interface VerifiedPaymentCallback {
  paymentMethod: 'momo' | 'vnpay';
  providerReference: string;
  orderReference: string;
  providerTransactionId: string;
  idempotencyKey: string;
  amount: number;
  currency: string;
  outcome: VerifiedPaymentOutcome;
}

export type PaymentReconciliationResult =
  | { status: 'reconciled' | 'already_completed'; providerTransactionId: string }
  | { status: 'still_pending'; providerStatus: string }
  | { status: 'mismatch'; reason: string }
  | { status: 'skipped' };

interface ReconciliationEvidence {
  valid: true;
  amount: number;
  currency: string;
  orderReference: string;
  providerTransactionId: string;
}
