import { BadRequestException } from '@nestjs/common';
import { PromotionRedemptionStatus } from 'src/entities/promotion-redemption.entity';
import { PromotionRedemptionService } from './promotion-redemption.service';

describe('PromotionRedemptionService', () => {
  const createService = () => {
    const redemption = {
      id: 'redemption-1',
      orderId: 'order-1',
      promotionCode: 'WELCOME',
      status: PromotionRedemptionStatus.COMMITTED,
      promotion: { id: 'promotion-1', code: 'WELCOME' },
    };
    const redemptionRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn().mockResolvedValue(redemption),
    };
    const promotionRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'promotion-1', code: 'WELCOME' }),
    };
    const manager = {
      getRepository: jest.fn((entity) =>
        entity.name === 'PromotionRedemption' ? redemptionRepository : promotionRepository,
      ),
    };
    const promotionService = { usePromotion: jest.fn().mockResolvedValue({}) };

    return {
      service: new PromotionRedemptionService(promotionService as never),
      manager,
      redemption,
      redemptionRepository,
      promotionService,
    };
  };

  it('increments usage and writes redemption through the same manager', async () => {
    const { service, manager, redemptionRepository, promotionService } = createService();

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

    expect(promotionService.usePromotion).toHaveBeenCalledWith('WELCOME', 100_000, manager);
    expect(redemptionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        status: PromotionRedemptionStatus.COMMITTED,
      }),
    );
  });

  it('is idempotent for a retried order and does not increment twice', async () => {
    const { service, manager, redemptionRepository, redemption, promotionService } =
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

    expect(promotionService.usePromotion).not.toHaveBeenCalled();
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
