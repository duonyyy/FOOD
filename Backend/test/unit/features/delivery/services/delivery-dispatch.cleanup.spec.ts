import { DeliveryDispatchService } from 'src/features/delivery/services/delivery-dispatch.service';

describe('DeliveryDispatchService expired assignment cleanup', () => {
  const previousQueueProcessorEnabled = process.env.QUEUE_PROCESSOR_ENABLED;
  const store = {
    getExpiredAssignments: jest.fn(),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const orderLifecycleCommand = {
    cancelUnassigned: jest.fn().mockResolvedValue({ orderId: 'order-1', status: 'canceled' }),
  };
  const service = new DeliveryDispatchService(
    orderLifecycleCommand as never,
    {} as never,
    {} as never,
    store as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.QUEUE_PROCESSOR_ENABLED;
    store.getExpiredAssignments.mockResolvedValue([
      {
        id: 'assignment-1',
        orderId: 'order-1',
        createdAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
      },
    ]);
  });

  afterAll(() => {
    if (previousQueueProcessorEnabled === undefined) {
      delete process.env.QUEUE_PROCESSOR_ENABLED;
      return;
    }
    process.env.QUEUE_PROCESSOR_ENABLED = previousQueueProcessorEnabled;
  });

  it('asks Orders to cancel before removing the Delivery assignment', async () => {
    await service.cleanupExpiredAssignments();

    expect(orderLifecycleCommand.cancelUnassigned).toHaveBeenCalledWith('order-1');
    expect(store.remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'assignment-1' }));
    expect(orderLifecycleCommand.cancelUnassigned.mock.invocationCallOrder[0]).toBeLessThan(
      store.remove.mock.invocationCallOrder[0],
    );
  });

  it('does not run API cleanup inside the queue worker process', async () => {
    process.env.QUEUE_PROCESSOR_ENABLED = 'true';

    await service.cleanupExpiredAssignments();

    expect(store.getExpiredAssignments).not.toHaveBeenCalled();
    expect(orderLifecycleCommand.cancelUnassigned).not.toHaveBeenCalled();
  });
});
