import { DeliveryDispatchService } from 'src/features/delivery/services/dispatch/delivery-dispatch.service';

describe('DeliveryDispatchService missing assignment restore', () => {
  const previousQueueProcessorEnabled = process.env.QUEUE_PROCESSOR_ENABLED;
  const orderDispatchReader = {
    listConfirmedOrderIds: jest.fn(),
    findConfirmedDispatchCandidate: jest.fn(),
  };
  const store = {
    getByOrderId: jest.fn(),
    createOrGet: jest.fn(),
  };
  const shippingDetailRepository = { exist: jest.fn() };
  const service = new DeliveryDispatchService(
    orderDispatchReader as never,
    shippingDetailRepository as never,
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
    orderDispatchReader.listConfirmedOrderIds.mockResolvedValue([
      'missing-order',
      'existing-order',
      'assigned-order',
      'stale-order',
    ]);
    orderDispatchReader.findConfirmedDispatchCandidate.mockImplementation((orderId: string) =>
      orderId === 'stale-order' ? Promise.resolve(null) : Promise.resolve({ orderId }),
    );
    store.getByOrderId.mockImplementation((orderId: string) =>
      Promise.resolve(orderId === 'existing-order' ? { id: 'assignment-1', orderId } : null),
    );
    store.createOrGet.mockImplementation((orderId: string) =>
      Promise.resolve({ id: `assignment-${orderId}`, orderId }),
    );
    shippingDetailRepository.exist.mockImplementation(
      ({ where }: { where: { order: { id: string } } }) =>
        Promise.resolve(where.order.id === 'assigned-order'),
    );
  });

  afterAll(() => {
    if (previousQueueProcessorEnabled === undefined) {
      delete process.env.QUEUE_PROCESSOR_ENABLED;
      return;
    }
    process.env.QUEUE_PROCESSOR_ENABLED = previousQueueProcessorEnabled;
  });

  it('restores missing assignments, skips existing ones and tolerates stale Orders', async () => {
    await expect(service.restoreMissingAssignments()).resolves.toEqual({
      checked: 4,
      restored: 1,
      skipped: 2,
      failed: 1,
    });

    expect(store.createOrGet).toHaveBeenCalledTimes(1);
    expect(store.createOrGet).toHaveBeenCalledWith('missing-order', 1);
    expect(store.createOrGet).not.toHaveBeenCalledWith('existing-order', expect.anything());
  });

  it('does not run the API restore job inside the queue worker process', async () => {
    process.env.QUEUE_PROCESSOR_ENABLED = 'true';

    await expect(service.restoreMissingAssignments()).resolves.toEqual({
      checked: 0,
      restored: 0,
      skipped: 0,
      failed: 0,
    });

    expect(orderDispatchReader.listConfirmedOrderIds).not.toHaveBeenCalled();
  });
});
