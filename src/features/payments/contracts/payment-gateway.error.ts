import axios from 'axios';
import type { PaymentGatewayProvider } from './payment-gateway.port';

export type PaymentGatewayErrorCode =
  | 'CONFIGURATION_MISSING'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'PROVIDER_REJECTED'
  | 'UNEXPECTED';

export class PaymentGatewayError extends Error {
  constructor(
    readonly provider: PaymentGatewayProvider,
    readonly operation: string,
    readonly code: PaymentGatewayErrorCode,
    readonly retryable: boolean,
    cause?: unknown,
  ) {
    super(`${provider} ${operation} failed: ${code}`);
    this.name = 'PaymentGatewayError';
    this.cause = cause;
  }
}

export function missingPaymentGatewayConfiguration(
  provider: PaymentGatewayProvider,
  operation: string,
): PaymentGatewayError {
  return new PaymentGatewayError(provider, operation, 'CONFIGURATION_MISSING', false);
}

export function mapPaymentGatewayError(
  provider: PaymentGatewayProvider,
  operation: string,
  error: unknown,
): PaymentGatewayError {
  if (error instanceof PaymentGatewayError) {
    return error;
  }
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new PaymentGatewayError(provider, operation, 'TIMEOUT', true, error);
    }
    if (!error.response) {
      return new PaymentGatewayError(provider, operation, 'NETWORK', true, error);
    }
    return new PaymentGatewayError(
      provider,
      operation,
      'PROVIDER_REJECTED',
      error.response.status >= 500 || error.response.status === 429,
      error,
    );
  }
  return new PaymentGatewayError(provider, operation, 'UNEXPECTED', false, error);
}
