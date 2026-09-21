import { BadRequestException } from '@nestjs/common';
import { PromotionRedemptionStatus } from 'src/entities/promotion-redemption.entity';
import { PromotionUsageService } from 'src/features/promotions/services/promotion-usage.service';

describe('PromotionUsageService', () => {
  const createService = () => {
    const usage = {
      id: 'usage-1',
      orderId: 'order-1',
      promotionCode: 'WELCOME',
      status: PromotionRedemptionStatus.COMMITTED,
      promotion: { id: 'promotion-1', code: 'WELCOME' },
    };
    const promotion = {
      id: 'promotion-1',
      code: 'WELCOME',
      numberOfUsed: 0,
      discountPercent: 10,
    };
    const usageRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value: unknown) => value),
      save: jest.fn().mockResolvedValue(usage),
    };
    const promotionRepository = {
      findOne: jest.fn().mockResolvedValue(promotion),
      save: jest.fn().mockImplementation((value: unknown) => Promise.resolve(value)),
    };
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        const entityName =
          (typeof entity === 'function' || (typeof entity === 'object' && entity !== null)) &&
          'name' in entity &&
          typeof entity.name === 'string'
            ? entity.name
            : undefined;
        return entityName === 'PromotionRedemption' ? usageRepository : promotionRepository;
      }),
    };
    const cacheService = { deleteByPattern: jest.fn() };

    return {
      service: new PromotionUsageService(cacheService as never),
      manager,
      usage,
      usageRepository,
      promotionRepository,
      cacheService,
    };
  };

  it('increments and records usage through the same manager', async () => {
    const { service, manager, usageRepository, promotionRepository } = createService();

    await expect(
      service.useInTransaction(
        {
          orderId: 'order-1',
          promotionCode: 'WELCOME',
          customerId: 'customer-1',
          subtotal: 100_000,
          discountAmount: 10_000,
        },
        manager as never,
      ),
    ).resolves.toMatchObject({ id: 'usage-1' });

    expect(promotionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'WELCOME', numberOfUsed: 1 }),
    );
    expect(usageRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        status: PromotionRedemptionStatus.COMMITTED,
      }),
    );
  });

  it('is idempotent for a retried order and does not increment twice', async () => {
    const { service, manager, usageRepository, usage, promotionRepository } = createService();
    usageRepository.findOne.mockResolvedValue(usage);

    await expect(
      service.useInTransaction(
        {
          orderId: 'order-1',
          promotionCode: 'WELCOME',
          customerId: 'customer-1',
          subtotal: 100_000,
          discountAmount: 10_000,
        },
        manager as never,
      ),
    ).resolves.toBe(usage);

    expect(promotionRepository.save).not.toHaveBeenCalled();
    expect(usageRepository.save).not.toHaveBeenCalled();
  });

  it('rejects reusing an order id with a different promotion code', async () => {
    const { service, manager, usage } = createService();
    const usageRepository = manager.getRepository({ name: 'PromotionRedemption' } as never);
    usageRepository.findOne.mockResolvedValue(usage);

    await expect(
      service.useInTransaction(
        {
          orderId: 'order-1',
          promotionCode: 'OTHER',
          customerId: 'customer-1',
          subtotal: 100_000,
          discountAmount: 10_000,
        },
        manager as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
