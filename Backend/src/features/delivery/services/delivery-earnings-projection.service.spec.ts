import { DeliveryCompletedEvent } from 'src/common/events/delivery-completed.event';
import { DeliveryEarningsEvent } from 'src/entities/deliveryEarningsEvent.entity';
import { ShipperProfile } from 'src/entities/shipperProfile.entity';
import { DeliveryEarningsProjectionService } from './delivery-earnings-projection.service';

describe('DeliveryEarningsProjectionService', () => {
  const createFixture = () => {
    const entries: DeliveryEarningsEvent[] = [];
    const profile = Object.assign(new ShipperProfile(), {
      userId: 'shipper-a',
      completedDeliveries: 0,
      totalEarnings: 0,
      averageDeliveryTime: 0,
      onTimeDeliveries: 0,
      lateDeliveries: 0,
      dailyEarnings: 0,
      weeklyEarnings: 0,
      monthlyEarnings: 0,
    });
    type EventRepositoryMock = {
      manager: { transaction: jest.Mock };
      findOne: jest.Mock;
      create: jest.Mock;
      save: jest.Mock;
      find: jest.Mock;
    };
    type ProfileRepositoryMock = {
      findOne: jest.Mock;
      create: jest.Mock;
      save: jest.Mock;
      find: jest.Mock;
    };
    type TransactionManagerMock = {
      getRepository: (
        entity: typeof DeliveryEarningsEvent | typeof ShipperProfile,
      ) => EventRepositoryMock | ProfileRepositoryMock;
    };

    const eventRepository: EventRepositoryMock = {
      manager: { transaction: jest.fn() },
      findOne: jest.fn(({ where }: { where: { idempotencyKey: string } }) =>
        Promise.resolve(
          entries.find((entry) => entry.idempotencyKey === where.idempotencyKey) ?? null,
        ),
      ),
      create: jest.fn((value: Partial<DeliveryEarningsEvent>) =>
        Object.assign(new DeliveryEarningsEvent(), value),
      ),
      save: jest.fn((entry: DeliveryEarningsEvent) => {
        entries.push(entry);
        return Promise.resolve(entry);
      }),
      find: jest.fn(() => Promise.resolve(entries)),
    };
    const profileRepository: ProfileRepositoryMock = {
      findOne: jest.fn(() => Promise.resolve(profile)),
      create: jest.fn((value: Partial<ShipperProfile>) =>
        Object.assign(new ShipperProfile(), value),
      ),
      save: jest.fn((value: ShipperProfile) => Promise.resolve(value)),
      find: jest.fn(() => Promise.resolve([profile])),
    };
    const manager: TransactionManagerMock = {
      getRepository: (entity) =>
        entity === DeliveryEarningsEvent ? eventRepository : profileRepository,
    };
    eventRepository.manager.transaction.mockImplementation(
      (callback: (transactionManager: TransactionManagerMock) => unknown) =>
        Promise.resolve(callback(manager)),
    );
    const service = new DeliveryEarningsProjectionService(
      eventRepository as never,
      profileRepository as never,
    );

    return { service, entries, profile, eventRepository, profileRepository };
  };

  const event: DeliveryCompletedEvent = {
    orderId: 'order-1',
    shipperId: 'shipper-a',
    shippingDetailId: 'shipping-1',
    completedAt: new Date().toISOString(),
    earnings: 35_000,
    deliveryTimeMinutes: 24,
    onTime: true,
  };

  it('projects earnings and performance exactly once', async () => {
    const { service, entries, profile } = createFixture();

    await expect(service.project(event)).resolves.toBe(true);
    await expect(service.project(event)).resolves.toBe(false);

    expect(entries).toHaveLength(1);
    expect(profile.completedDeliveries).toBe(1);
    expect(profile.totalEarnings).toBe(35_000);
    expect(profile.onTimeDeliveries).toBe(1);
    expect(profile.dailyEarnings).toBe(35_000);
  });

  it('rebuilds the profile from the immutable ledger', async () => {
    const { service, entries, profile } = createFixture();
    entries.push(
      Object.assign(new DeliveryEarningsEvent(), {
        idempotencyKey: 'delivery-completed:order-1',
        orderId: 'order-1',
        shipperId: 'shipper-a',
        earnings: 20_000,
        completedAt: new Date().toISOString(),
        deliveryTimeMinutes: 30,
        onTime: false,
      }),
      Object.assign(new DeliveryEarningsEvent(), {
        idempotencyKey: 'delivery-completed:order-2',
        orderId: 'order-2',
        shipperId: 'shipper-a',
        earnings: 25_000,
        completedAt: new Date().toISOString(),
        deliveryTimeMinutes: 20,
        onTime: true,
      }),
    );

    await service.rebuild('shipper-a');

    expect(profile.completedDeliveries).toBe(2);
    expect(profile.totalEarnings).toBe(45_000);
    expect(profile.averageDeliveryTime).toBe(25);
    expect(profile.onTimeDeliveries).toBe(1);
    expect(profile.lateDeliveries).toBe(1);
  });
});
