import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import {
  mapPaymentGatewayError,
  missingPaymentGatewayConfiguration,
} from 'src/features/payments/contracts/payment-gateway.error';
import {
  type PaymentGatewayConfig,
  type PaymentGatewayPort,
  type PaymentIntent,
  type PaymentResult,
  PaymentStatus,
} from 'src/features/payments/contracts/payment-gateway.port';
import { getProviderErrorCode, getProviderErrorType } from 'src/infra/logging/provider-error';

/**
 * Momo Payment Gateway Implementation
 *
 * This class implements the IPaymentGateway interface for the Momo payment service.
 * It handles payment creation, confirmation, cancellation, and status checking.
 */
@Injectable()
export class MomoPaymentGateway implements PaymentGatewayPort, OnModuleInit {
  readonly provider = 'momo';
  private readonly logger = new Logger(MomoPaymentGateway.name);
  private config: PaymentGatewayConfig;
  private baseUrl: string;
  private momoConfig: {
    accessKey: string;
    secretKey: string;
    partnerCode: string;
    redirectUrl: string;
    ipnUrl: string;
    requestType: string;
    lang: string;
  };

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.initialize({
      environment:
        this.configService.get<string>('NODE_ENV') === 'production' ? 'production' : 'sandbox',
    });
  }

  /**
   * Initialize the Momo payment gateway with configuration
   * @param config Payment gateway configuration
   */
  initialize(config: PaymentGatewayConfig): void {
    this.config = config;

    // Credentials must come from environment; never ship provider sample secrets.
    this.momoConfig = {
      accessKey: this.configService.get<string>('MOMO_ACCESS_KEY') || config.apiKey || '',
      secretKey: this.configService.get<string>('MOMO_SECRET_KEY') || config.secretKey || '',
      partnerCode: this.configService.get<string>('MOMO_PARTNER_CODE') || '',
      redirectUrl: this.configService.get<string>('MOMO_REDIRECT_URL') || '',
      ipnUrl: this.configService.get<string>('MOMO_IPN_URL') || '',
      requestType: this.configService.get<string>('MOMO_REQUEST_TYPE') || 'payWithMethod',
      lang: this.configService.get<string>('MOMO_LANG') || 'vi',
    };
    if (!this.hasRequiredConfiguration()) {
      if (config.environment === 'production') {
        throw new Error('MOMO_ACCESS_KEY and MOMO_SECRET_KEY are required in production');
      }
      this.logger.warn({
        event: 'provider_configuration_missing',
        provider: 'momo',
        errorCode: 'CREDENTIALS_MISSING',
      });
    }

    // Set base URL from environment or use default
    this.baseUrl =
      this.configService.get<string>('MOMO_BASE_URL') ||
      'https://test-payment.momo.vn/v2/gateway/api';

    this.logger.log({
      event: 'provider_initialized',
      provider: 'momo',
      environment: config.environment,
    });
  }

  /**
   * Create a payment intent with Momo
   * @param orderId Order ID
   * @param amount Amount to charge
   * @param currency Currency code (VND)
   * @param metadata Additional metadata
   * @returns Payment intent
   */
  async createPaymentIntent(
    orderId: string,
    amount: number,
    currency: string,
    metadata?: Record<string, unknown>,
  ): Promise<PaymentIntent> {
    try {
      this.assertConfigured('create_payment_intent');
      // Extract configuration values
      const {
        accessKey,
        secretKey,
        partnerCode,
        redirectUrl: redirectUrlFromConfig,
        ipnUrl: ipnUrlFromConfig,
        requestType,
        lang,
      } = this.momoConfig;

      // Set default values for optional parameters
      const orderInfo = metadataString(metadata, 'orderInfo', 'pay with MoMo');
      const extraData = metadataString(metadata, 'extraData', '');
      const orderGroupId = metadataString(metadata, 'orderGroupId', '');
      const redirectUrl = metadataString(metadata, 'redirectUrl', redirectUrlFromConfig);
      const callbackUrl = metadataString(metadata, 'ipnUrl', ipnUrlFromConfig);
      const autoCapture = true;

      // Set request ID to order ID
      const requestId = orderId;

      // Create signature for the request
      const rawSignature = this.createSignature({
        accessKey,
        amount,
        extraData,
        ipnUrl: callbackUrl,
        orderId,
        orderInfo,
        partnerCode,
        redirectUrl,
        requestId,
        requestType,
      });

      // Generate HMAC signature
      const signature = this.generateHmacSignature(rawSignature, secretKey);

      // Prepare request body
      const requestBody = JSON.stringify({
        partnerCode,
        partnerName: 'Test',
        storeId: 'MomoTestStore',
        requestId,
        amount,
        orderId,
        orderInfo,
        redirectUrl,
        ipnUrl: callbackUrl,
        lang,
        requestType,
        autoCapture,
        extraData,
        orderGroupId,
        signature,
      });

      // Configure axios request options
      const options = {
        method: 'POST',
        url: `${this.baseUrl}/create`,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
        },
        data: requestBody,
        timeout: this.timeoutMs,
      };

      // Send request to Momo
      const response = await axios(options);
      const { payUrl, orderId: momoOrderId, requestId: momoRequestId } = response.data;

      // Return payment intent
      return {
        id: momoOrderId,
        amount,
        currency,
        status: PaymentStatus.PENDING,
        clientSecret: payUrl,
        metadata: {
          ...metadata,
          momoRequestId,
        },
      };
    } catch (error) {
      const mapped = mapPaymentGatewayError('momo', 'create_payment_intent', error);
      this.logProviderError('create_payment_intent', mapped);
      throw mapped;
    }
  }

  /**
   * Confirm a payment intent
   * @param paymentIntentId Payment intent ID
   * @returns Payment result
   */
  async confirmPaymentIntent(paymentIntentId: string): Promise<PaymentResult> {
    try {
      // For Momo, we don't need to confirm the payment intent
      // The payment is confirmed via webhook
      return {
        success: true,
        paymentIntentId,
      };
    } catch (error) {
      const mapped = mapPaymentGatewayError('momo', 'confirm_payment_intent', error);
      this.logProviderError('confirm_payment_intent', mapped);
      return {
        success: false,
        error: mapped.code,
      };
    }
  }

  /**
   * Cancel a payment intent
   * @param paymentIntentId Payment intent ID
   * @returns Payment result
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<PaymentResult> {
    try {
      // Momo doesn't support canceling payment intents directly
      // We can only check the status
      const { status } = await this.checkTransactionStatus(paymentIntentId);

      if (status === PaymentStatus.PENDING) {
        return {
          success: true,
          paymentIntentId,
        };
      } else {
        return {
          success: false,
          error: 'Payment is already processed',
        };
      }
    } catch (error) {
      const mapped = mapPaymentGatewayError('momo', 'cancel_payment_intent', error);
      this.logProviderError('cancel_payment_intent', mapped);
      return {
        success: false,
        error: mapped.code,
      };
    }
  }

  /**
   * Refund a payment
   * @param paymentIntentId Payment intent ID
   * @param amount Amount to refund
   * @returns Payment result
   */
  async refundPayment(paymentIntentId: string, amount?: number): Promise<PaymentResult> {
    // Momo doesn't support refunds in this implementation
    return {
      success: false,
      error: 'Refunds are not supported by this payment gateway',
    };
  }

  /**
   * Get a payment intent
   * @param paymentIntentId Payment intent ID
   * @returns Payment intent
   */
  async getPaymentIntent(paymentIntentId: string): Promise<PaymentIntent> {
    try {
      const query = await this.checkTransactionStatus(paymentIntentId);

      return {
        id: paymentIntentId,
        amount: query.amount,
        currency: query.currency,
        status: query.status,
        providerTransactionId: query.providerTransactionId,
        metadata: {
          orderId: query.orderReference,
          providerReference: query.providerReference,
        },
      };
    } catch (error) {
      const mapped = mapPaymentGatewayError('momo', 'get_payment_intent', error);
      this.logProviderError('get_payment_intent', mapped);
      throw mapped;
    }
  }

  /**
   * Verify webhook signature
   * @param payload Webhook payload
   * @param signature Webhook signature
   * @returns Whether the signature is valid
   */
  verifyWebhookSignature(payload: Record<string, unknown>, signature: string): boolean {
    try {
      if (!this.hasRequiredConfiguration()) {
        this.logProviderError(
          'verify_webhook_signature',
          missingPaymentGatewayConfiguration('momo', 'verify_webhook_signature'),
        );
        return false;
      }
      // For Momo, we need to verify the signature from the webhook
      // The signature is created using the same method as the request
      const rawSignature =
        'accessKey=' +
        this.momoConfig.accessKey +
        '&orderId=' +
        paymentPayloadString(payload.orderId) +
        '&partnerCode=' +
        paymentPayloadString(payload.partnerCode) +
        '&requestId=' +
        paymentPayloadString(payload.requestId);

      const expectedSignature = this.generateHmacSignature(rawSignature, this.momoConfig.secretKey);

      return expectedSignature === signature;
    } catch (error) {
      this.logProviderError('verify_webhook_signature', error);
      return false;
    }
  }

  /**
   * Handle webhook event
   * @param payload Webhook payload
   */
  async handleWebhookEvent(_payload: Record<string, unknown>): Promise<void> {
    // Momo webhook handling is done in the PaymentService
    // This method is just a placeholder
  }

  /**
   * Check transaction status
   * @param orderId Order ID
   * @returns Payment status
   */
  private async checkTransactionStatus(orderId: string): Promise<MomoQueryResult> {
    try {
      this.assertConfigured('check_transaction_status');
      const { accessKey, secretKey, partnerCode, lang } = this.momoConfig;
      const requestId = orderId;

      // Create signature for the request
      const rawSignature =
        'accessKey=' +
        accessKey +
        '&orderId=' +
        orderId +
        '&partnerCode=' +
        partnerCode +
        '&requestId=' +
        requestId;

      const signature = this.generateHmacSignature(rawSignature, secretKey);

      // Prepare request body
      const requestBody = {
        partnerCode,
        requestId,
        orderId,
        signature,
        lang,
      };

      // Send request to Momo
      const response = await axios.post(`${this.baseUrl}/query`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: this.timeoutMs,
      });

      const {
        resultCode,
        amount,
        orderId: providerReference,
        orderInfo: orderReference,
        transId,
        currency,
      } = response.data;

      // MoMo may serialize resultCode as either a number or a string.
      const normalizedResultCode = String(resultCode);

      // Map Momo result codes to PaymentStatus
      return {
        status:
          normalizedResultCode === '0' || normalizedResultCode === '9000'
            ? PaymentStatus.SUCCEEDED
            : PaymentStatus.FAILED,
        amount: Number.isFinite(Number(amount)) ? Number(amount) : 0,
        currency: typeof currency === 'string' && currency.trim() ? currency : 'VND',
        providerReference:
          typeof providerReference === 'string' && providerReference.trim()
            ? providerReference
            : orderId,
        orderReference:
          typeof orderReference === 'string' && orderReference.trim() ? orderReference : undefined,
        providerTransactionId: typeof transId === 'string' && transId.trim() ? transId : undefined,
      };
    } catch (error) {
      const mapped = mapPaymentGatewayError('momo', 'check_transaction_status', error);
      this.logProviderError('check_transaction_status', mapped);
      throw mapped;
    }
  }

  private get timeoutMs(): number {
    const configured = Number(
      this.configService.get<string>('PAYMENT_GATEWAY_TIMEOUT_MS', '10000'),
    );
    return Number.isFinite(configured) && configured > 0 ? configured : 10000;
  }

  private hasRequiredConfiguration(): boolean {
    return Boolean(
      this.momoConfig?.accessKey && this.momoConfig?.secretKey && this.momoConfig?.partnerCode,
    );
  }

  private assertConfigured(operation: string): void {
    if (!this.hasRequiredConfiguration()) {
      throw missingPaymentGatewayConfiguration('momo', operation);
    }
  }

  private logProviderError(operation: string, error: unknown): void {
    this.logger.error({
      event: 'provider_operation_failed',
      provider: 'momo',
      operation,
      errorCode: getProviderErrorCode(error),
      errorType: getProviderErrorType(error),
      retryable: error instanceof Error && 'retryable' in error ? error.retryable : false,
    });
  }

  /**
   * Create signature string for Momo API
   * @param params Parameters to include in signature
   * @returns Signature string
   */
  private createSignature(params: {
    accessKey: string;
    amount: number;
    extraData: string;
    ipnUrl: string;
    orderId: string;
    orderInfo: string;
    partnerCode: string;
    redirectUrl: string;
    requestId: string;
    requestType: string;
  }): string {
    const {
      accessKey,
      amount,
      extraData,
      ipnUrl,
      orderId,
      orderInfo,
      partnerCode,
      redirectUrl,
      requestId,
      requestType,
    } = params;

    return (
      'accessKey=' +
      accessKey +
      '&amount=' +
      amount +
      '&extraData=' +
      extraData +
      '&ipnUrl=' +
      ipnUrl +
      '&orderId=' +
      orderId +
      '&orderInfo=' +
      orderInfo +
      '&partnerCode=' +
      partnerCode +
      '&redirectUrl=' +
      redirectUrl +
      '&requestId=' +
      requestId +
      '&requestType=' +
      requestType
    );
  }

  /**
   * Generate HMAC signature
   * @param rawSignature Raw signature string
   * @param secretKey Secret key
   * @returns HMAC signature
   */
  private generateHmacSignature(rawSignature: string, secretKey: string): string {
    return crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');
  }
}

function paymentPayloadString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return '';
}

function metadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
  fallback: string,
): string {
  return typeof metadata?.[key] === 'string' ? metadata[key] : fallback;
}

interface MomoQueryResult {
  status: PaymentStatus;
  amount: number;
  currency: string;
  providerReference: string;
  orderReference?: string;
  providerTransactionId?: string;
}
