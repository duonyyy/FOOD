/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { ConflictException } from '@nestjs/common';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import { RESTAURANT_APPROVAL_DECIDED_EVENT } from 'src/common/events/restaurant-approval-decided.event';
import { RestaurantStatus } from 'src/entities/restaurant.entity';
import { RestaurantApprovalAction } from 'src/entities/restaurantApprovalAudit.entity';
import { type CachePort } from 'src/infra/contracts/cache.port';
import { RestaurantApprovalService } from './restaurant-approval.service';

describe('RestaurantApprovalService', () => {
  const restaurant = {
    id: 'restaurant-1',
    status: RestaurantStatus.PENDING,
    owner: { id: 'restaurant-owner-1' },
  };
  const restaurantRepository = {
    manager: {
      transaction: jest.fn(),
    },
  };
  const approvalAuditRepository = {};
  const cache: CachePort = {
    remember: <Value>(_key: string, _ttl: number, loader: () => Promise<Value>): Promise<Value> =>
      loader(),
    deleteByPattern: jest.fn((): Promise<number> => Promise.resolve(0)),
  };
  const eventBus = { publish: jest.fn((): Promise<void> => Promise.resolve()) };
  const service = new RestaurantApprovalService(
    restaurantRepository as never,
    approvalAuditRepository as never,
    cache,
    eventBus as unknown as InProcessEventBus,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    restaurant.status = RestaurantStatus.PENDING;
  });

  function mockTransaction(options?: { status?: RestaurantStatus }) {
    const restaurantRepo = {
      findOne: jest.fn(() =>
        Promise.resolve({ ...restaurant, status: options?.status ?? restaurant.status }),
      ),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };
    const auditRepo = {
      create: jest.fn((entity) => entity),
      save: jest.fn((entity) =>
        Promise.resolve({ id: 'audit-1', createdAt: new Date(), ...entity }),
      ),
    };
    const manager = {
      getRepository: jest.fn((entity) =>
        entity.name === 'Restaurant' ? restaurantRepo : auditRepo,
      ),
    };
    restaurantRepository.manager.transaction.mockImplementation((work) => work(manager));
    return { restaurantRepo, auditRepo };
  }

  it('approves a pending restaurant, persists the audit and emits an event', async () => {
    const { auditRepo } = mockTransaction();

    const result = await service.approveRestaurant('restaurant-1', 'admin-1', {
      note: 'Hồ sơ hợp lệ',
    });

    expect(result.status).toBe(RestaurantStatus.APPROVED);
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: 'restaurant-1',
        actorUserId: 'admin-1',
        action: RestaurantApprovalAction.APPROVED,
        reason: 'Hồ sơ hợp lệ',
        previousStatus: RestaurantStatus.PENDING,
        nextStatus: RestaurantStatus.APPROVED,
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      RESTAURANT_APPROVAL_DECIDED_EVENT,
      expect.objectContaining({ action: RestaurantApprovalAction.APPROVED, auditId: 'audit-1' }),
    );
  });

  it.each([RestaurantStatus.APPROVED, RestaurantStatus.REJECTED])(
    'rejects a repeated decision from %s',
    async (status) => {
      mockTransaction({ status });

      await expect(
        service.rejectRestaurant('restaurant-1', 'admin-1', { reason: 'Không hợp lệ' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(eventBus.publish).not.toHaveBeenCalled();
    },
  );
});
