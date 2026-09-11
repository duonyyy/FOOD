import { NotFoundException } from '@nestjs/common';
import { MessengerService } from 'src/features/communications/messenger/messenger.service';

describe('MessengerService subscription access', () => {
  const getOne = jest.fn();
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne,
  };
  const conversationRepository = {
    createQueryBuilder: jest.fn(() => queryBuilder),
  };
  const service = new MessengerService(
    conversationRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('uses a participant-scoped query when authorizing a subscription', async () => {
    getOne.mockResolvedValue({ id: 'conversation-a' });

    await expect(service.isConversationParticipant('customer-a', 'conversation-a')).resolves.toBe(
      true,
    );
    expect(queryBuilder.where).toHaveBeenCalledWith('conversation.id = :conversationId', {
      conversationId: 'conversation-a',
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '(conversation.participant1_id = :userId OR conversation.participant2_id = :userId)',
      { userId: 'customer-a' },
    );
  });

  it('returns the same not-found result for a non-participant', async () => {
    getOne.mockResolvedValue(null);

    await expect(
      service.assertConversationParticipant('customer-b', 'conversation-a'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
