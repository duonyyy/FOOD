import { RedisPendingAssignmentStore } from 'src/features/delivery/adapters/redis-pending-assignment-store.service';
import { DELIVERY_DISPATCH_POLICY } from 'src/features/delivery/contracts/delivery-dispatch.policy';

describe('RedisPendingAssignmentStore', () => {
  const pipeline = {
    set: jest.fn(),
    del: jest.fn(),
    zadd: jest.fn(),
    zrem: jest.fn(),
    sadd: jest.fn(),
    expire: jest.fn(),
    exec: jest.fn(),
  };
  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    pipeline: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    for (const method of ['set', 'del', 'zadd', 'zrem', 'sadd', 'expire'] as const) {
      pipeline[method].mockReturnValue(pipeline);
    }
    pipeline.exec.mockResolvedValue([]);
    redis.pipeline.mockReturnValue(pipeline);
  });

  it('keeps assignment TTL policy in Delivery while persisting through Redis', async () => {
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue('OK');
    const store = new RedisPendingAssignmentStore(redis as never);

    const assignment = await store.createOrGet('order-1', 7);

    expect(assignment).toEqual(
      expect.objectContaining({ orderId: 'order-1', priority: 7, attemptCount: 0 }),
    );
    expect(redis.set).toHaveBeenCalledWith(
      'pending-assignment:order:order-1',
      assignment.id,
      'EX',
      DELIVERY_DISPATCH_POLICY.pendingAssignmentTtlSeconds,
      'NX',
    );
    expect(pipeline.set).toHaveBeenCalledWith(
      `pending-assignment:${assignment.id}`,
      JSON.stringify(assignment),
      'EX',
      DELIVERY_DISPATCH_POLICY.pendingAssignmentTtlSeconds,
    );
  });

  it('uses the Delivery offer-hold policy for both shipper and order holds', async () => {
    const store = new RedisPendingAssignmentStore(redis as never);
    const assignment = {
      id: 'assignment-1',
      orderId: 'order-1',
      priority: 1,
      attemptCount: 0,
      lastAttemptAt: null,
      nextAttemptAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      notes: null,
      isSentToShipper: false,
      targetShipperId: null,
    };

    await store.markShipperNotified(assignment, 'shipper-1');

    const holdWrites = (pipeline.set.mock.calls as unknown[][]).filter(
      (call) =>
        String(call[0]).includes('assignment:shipper:') || String(call[0]).includes('order-hold:'),
    );
    expect(holdWrites).toHaveLength(2);
    for (const write of holdWrites) {
      expect(write.slice(-2)).toEqual(['EX', DELIVERY_DISPATCH_POLICY.offerHoldTtlSeconds]);
    }
  });

  it('fails closed to a cache miss when stored JSON is corrupt', async () => {
    redis.get.mockResolvedValue('{invalid-json');
    const store = new RedisPendingAssignmentStore(redis as never);

    await expect(store.getById('assignment-1')).resolves.toBeNull();
  });
});
