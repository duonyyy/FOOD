export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  DELIVERING = 'delivering',
  SHIPPER_RECEIVED = 'shipper_received',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
  PROCESSING_PAYMENT = 'processing_payment',
}

export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> =
  Object.freeze({
    [OrderStatus.PENDING]: Object.freeze([OrderStatus.CONFIRMED, OrderStatus.CANCELED]),
    [OrderStatus.CONFIRMED]: Object.freeze([
      OrderStatus.SHIPPER_RECEIVED,
      OrderStatus.DELIVERING,
      OrderStatus.CANCELED,
    ]),
    [OrderStatus.SHIPPER_RECEIVED]: Object.freeze([OrderStatus.DELIVERING, OrderStatus.CANCELED]),
    [OrderStatus.DELIVERING]: Object.freeze([OrderStatus.COMPLETED, OrderStatus.CANCELED]),
    [OrderStatus.PROCESSING_PAYMENT]: Object.freeze([OrderStatus.PENDING, OrderStatus.CANCELED]),
    [OrderStatus.COMPLETED]: Object.freeze([]),
    [OrderStatus.CANCELED]: Object.freeze([]),
  });

export class InvalidOrderStatusError extends Error {
  constructor(public readonly status: string) {
    super(`Invalid order status: ${status}`);
    this.name = 'InvalidOrderStatusError';
  }
}

export class InvalidOrderTransitionError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(`Cannot change status from ${from} to ${to}`);
    this.name = 'InvalidOrderTransitionError';
  }
}

export function parseOrderStatus(status: string): OrderStatus {
  if (Object.values(OrderStatus).includes(status as OrderStatus)) {
    return status as OrderStatus;
  }

  throw new InvalidOrderStatusError(status);
}

export class OrderStateMachine {
  canTransition(from: string, to: string): boolean {
    const currentStatus = parseOrderStatus(from);
    const nextStatus = parseOrderStatus(to);

    return ORDER_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
  }

  transition(from: string, to: string): OrderStatus {
    const currentStatus = parseOrderStatus(from);
    const nextStatus = parseOrderStatus(to);

    if (!ORDER_STATUS_TRANSITIONS[currentStatus].includes(nextStatus)) {
      throw new InvalidOrderTransitionError(currentStatus, nextStatus);
    }

    return nextStatus;
  }

  confirm(from: string): OrderStatus {
    return this.transition(from, OrderStatus.CONFIRMED);
  }

  reject(from: string): OrderStatus {
    return this.cancel(from);
  }

  cancel(from: string): OrderStatus {
    return this.transition(from, OrderStatus.CANCELED);
  }

  markShipperReceived(from: string): OrderStatus {
    return this.transition(from, OrderStatus.SHIPPER_RECEIVED);
  }

  startDelivery(from: string): OrderStatus {
    return this.transition(from, OrderStatus.DELIVERING);
  }

  complete(from: string): OrderStatus {
    return this.transition(from, OrderStatus.COMPLETED);
  }

  startPayment(from: string): OrderStatus {
    const currentStatus = parseOrderStatus(from);

    if (currentStatus !== OrderStatus.PENDING) {
      throw new InvalidOrderTransitionError(currentStatus, OrderStatus.PROCESSING_PAYMENT);
    }

    return OrderStatus.PROCESSING_PAYMENT;
  }

  markPaid(from: string): OrderStatus {
    const currentStatus = parseOrderStatus(from);

    if (currentStatus !== OrderStatus.PENDING && currentStatus !== OrderStatus.PROCESSING_PAYMENT) {
      throw new InvalidOrderTransitionError(currentStatus, OrderStatus.COMPLETED);
    }

    return OrderStatus.COMPLETED;
  }
}
