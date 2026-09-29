/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import { RESTAURANT_APPROVAL_DECIDED_EVENT } from 'src/common/events/restaurant-approval-decided.event';
import { RestaurantStatus } from 'src/entities/restaurant.entity';
import { RestaurantApprovalAction } from 'src/entities/restaurantApprovalAudit.entity';
import { AdminRestaurantsService } from 'src/features/restaurants/services/admin-restaurants.service';

describe('AdminRestaurantsService', () => {
  const restaurant = {
    id: 'restaurant-1',
    status: RestaurantStatus.PENDING,
    owner: { id: 'restaurant-owner-1' },
  };
  const restaurantRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    manager: {
      transaction: jest.fn(),
    },
  };
  const storage = { getSignedPrivateUrl: jest.fn() };
  const deleteByPattern = jest.fn((): Promise<number> => Promise.resolve(0));
  const cache = {
    remember: <Value>(_key: string, _ttl: number, loader: () => Promise<Value>): Promise<Value> =>
      loader(),
    deleteByPattern,
  };
  const eventBus = { publish: jest.fn((): Promise<void> => Promise.resolve()) };
  const service = new AdminRestaurantsService(
    restaurantRepository as never,
    cache as never,
    eventBus as unknown as InProcessEventBus,
    storage as never,
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
    expect(deleteByPattern).toHaveBeenCalledWith('food:*');
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

  it('lists only pending requests for admin review', async () => {
    restaurantRepository.findAndCount.mockResolvedValue([[restaurant], 1]);

    const result = await service.getRestaurantRequests(2, 5);

    expect(restaurantRepository.findAndCount).toHaveBeenCalledWith({
      where: { status: RestaurantStatus.PENDING },
      relations: ['owner'],
      skip: 5,
      take: 5,
    });
    expect(result).toMatchObject({ totalItems: 1, page: 2, pageSize: 5, totalPages: 1 });
  });

  it('does not delete a request that is no longer pending', async () => {
    restaurantRepository.findOne.mockResolvedValue({
      ...restaurant,
      status: RestaurantStatus.APPROVED,
    });

    await expect(service.deleteRestaurantRequest('restaurant-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(restaurantRepository.remove).not.toHaveBeenCalled();
  });

  it('returns a signed certificate URL for admin review', async () => {
    restaurantRepository.findOne.mockResolvedValue({
      ...restaurant,
      certificateImage: 'restaurant-certificates/certificate.png',
    });
    storage.getSignedPrivateUrl.mockResolvedValue('https://signed.example.test/certificate');

    await expect(service.getCertificateDownloadUrl('restaurant-1')).resolves.toBe(
      'https://signed.example.test/certificate',
    );
    expect(storage.getSignedPrivateUrl).toHaveBeenCalledWith(
      'restaurant-certificates/certificate.png',
    );
  });
});
