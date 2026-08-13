import {
  InvalidOrderStatusError,
  InvalidOrderTransitionError,
  ORDER_STATUS_TRANSITIONS,
  OrderStateMachine,
  OrderStatus,
} from './order-status';

describe('OrderStateMachine', () => {
  const stateMachine = new OrderStateMachine();

  it.each(
    Object.entries(ORDER_STATUS_TRANSITIONS).flatMap(([from, destinations]) =>
      destinations.map((to) => ({ from, to })),
    ),
  )('allows %s -> %s', ({ from, to }) => {
    expect(stateMachine.canTransition(from, to)).toBe(true);
    expect(stateMachine.transition(from, to)).toBe(to);
  });

  it.each([
    [OrderStatus.PENDING, OrderStatus.COMPLETED],
    [OrderStatus.CONFIRMED, OrderStatus.PENDING],
    [OrderStatus.DELIVERING, OrderStatus.CONFIRMED],
    [OrderStatus.COMPLETED, OrderStatus.CANCELED],
    [OrderStatus.CANCELED, OrderStatus.PENDING],
    [OrderStatus.PROCESSING_PAYMENT, OrderStatus.COMPLETED],
  ])('rejects invalid transition %s -> %s', (from, to) => {
    expect(stateMachine.canTransition(from, to)).toBe(false);
    expect(() => stateMachine.transition(from, to)).toThrow(
      new InvalidOrderTransitionError(from, to),
    );
  });

  it('rejects unknown statuses with a stable error', () => {
    expect(() => stateMachine.transition('unknown', OrderStatus.CONFIRMED)).toThrow(
      new InvalidOrderStatusError('unknown'),
    );
  });

  it('supports command-specific confirmation and payment transitions', () => {
    expect(stateMachine.confirm(OrderStatus.PENDING)).toBe(OrderStatus.CONFIRMED);
    expect(stateMachine.reject(OrderStatus.PENDING)).toBe(OrderStatus.CANCELED);
    expect(stateMachine.cancel(OrderStatus.CONFIRMED)).toBe(OrderStatus.CANCELED);
    expect(stateMachine.markShipperReceived(OrderStatus.CONFIRMED)).toBe(
      OrderStatus.SHIPPER_RECEIVED,
    );
    expect(stateMachine.startDelivery(OrderStatus.SHIPPER_RECEIVED)).toBe(OrderStatus.DELIVERING);
    expect(stateMachine.complete(OrderStatus.DELIVERING)).toBe(OrderStatus.COMPLETED);
    expect(stateMachine.startPayment(OrderStatus.PENDING)).toBe(OrderStatus.PROCESSING_PAYMENT);
    expect(stateMachine.markPaid(OrderStatus.PENDING)).toBe(OrderStatus.COMPLETED);
    expect(stateMachine.markPaid(OrderStatus.PROCESSING_PAYMENT)).toBe(OrderStatus.COMPLETED);
  });

  it('keeps queries pure and does not mutate the transition table', () => {
    const before = [...ORDER_STATUS_TRANSITIONS[OrderStatus.PENDING]];

    stateMachine.canTransition(OrderStatus.PENDING, OrderStatus.CONFIRMED);

    expect(ORDER_STATUS_TRANSITIONS[OrderStatus.PENDING]).toEqual(before);
  });
});
