import { BadRequestException } from '@nestjs/common';
import { PromotionRedemptionStatus } from 'src/entities/promotion-redemption.entity';
import { PromotionRedemptionService } from 'src/features/promotions/services/promotion-redemption.service';

describe('PromotionRedemptionService', () => {
  const createService = () => {
    const redemption = {
      id: 'redemption-1',
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
    const redemptionRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value: unknown) => value),
      save: jest.fn().mockResolvedValue(redemption),
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
        return entityName === 'PromotionRedemption' ? redemptionRepository : promotionRepository;
      }),
    };
    const cacheService = { deleteByPattern: jest.fn() };

    return {
      service: new PromotionRedemptionService(cacheService as never),
      manager,
      redemption,
      redemptionRepository,
      promotionRepository,
      cacheService,
    };
  };

  it('increments usage and writes redemption through the same manager', async () => {
    const { service, manager, redemptionRepository, promotionRepository } = createService();

    await expect(
      service.redeemInTransaction(
        {
          orderId: 'order-1',
          promotionCode: 'WELCOME',
          customerId: 'customer-1',
          subtotal: 100_000,
          discountAmount: 10_000,
        },
        manager as never,
      ),
    ).resolves.toMatchObject({ id: 'redemption-1' });

    expect(promotionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'WELCOME', numberOfUsed: 1 }),
    );
    expect(redemptionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        status: PromotionRedemptionStatus.COMMITTED,
      }),
    );
  });

  it('is idempotent for a retried order and does not increment twice', async () => {
    const { service, manager, redemptionRepository, redemption, promotionRepository } =
      createService();
    redemptionRepository.findOne.mockResolvedValue(redemption);

    await expect(
      service.redeemInTransaction(
        {
          orderId: 'order-1',
          promotionCode: 'WELCOME',
          customerId: 'customer-1',
          subtotal: 100_000,
          discountAmount: 10_000,
        },
        manager as never,
      ),
    ).resolves.toBe(redemption);

    expect(promotionRepository.save).not.toHaveBeenCalled();
    expect(redemptionRepository.save).not.toHaveBeenCalled();
  });

  it('rejects reusing an order id with a different promotion code', async () => {
    const { service, manager, redemption } = createService();
    const redemptionRepository = manager.getRepository({ name: 'PromotionRedemption' } as never);
    redemptionRepository.findOne.mockResolvedValue(redemption);

    await expect(
      service.redeemInTransaction(
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
