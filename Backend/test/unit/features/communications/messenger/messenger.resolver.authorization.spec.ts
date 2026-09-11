import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { WebSocketAuthGuard } from 'src/features/auth/public-api';
import { MessengerResolver } from 'src/features/communications/messenger/messenger.resolver';

jest.mock('src/pubsub', () => {
  const asyncIterableIterator = jest.fn();
  return {
    pubSub: { asyncIterableIterator },
    __testDoubles: { asyncIterableIterator },
  };
});

const pubSubTestDoubles = jest.requireMock<{
  __testDoubles: { asyncIterableIterator: jest.Mock };
}>('src/pubsub');
const mockAsyncIterableIterator = pubSubTestDoubles.__testDoubles.asyncIterableIterator;

function getResolverMethod(prototype: object, methodName: string): () => unknown {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName) as
    | TypedPropertyDescriptor<() => unknown>
    | undefined;

  if (typeof descriptor?.value !== 'function') {
    throw new Error(`Expected ${methodName} to be a resolver method`);
  }

  return descriptor.value;
}

describe('MessengerResolver subscription authorization', () => {
  const messengerService = {
    assertConversationParticipant: jest.fn(),
    isConversationParticipant: jest.fn(),
  };
  const resolver = new MessengerResolver(messengerService as never);

  beforeEach(() => jest.clearAllMocks());

  it('does not create an iterator for a non-participant', async () => {
    messengerService.assertConversationParticipant.mockRejectedValue(
      new NotFoundException('Conversation not found'),
    );

    await expect(
      resolver.messageSent('conversation-a', {
        connection: { context: { user: { id: 'customer-b' } } },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(messengerService.assertConversationParticipant).toHaveBeenCalledWith(
      'customer-b',
      'conversation-a',
    );
    expect(mockAsyncIterableIterator).not.toHaveBeenCalled();
  });

  it('uses WebSocket authentication for both conversation subscriptions', () => {
    for (const methodName of ['messageSent', 'messagesRead']) {
      const resolverMethod = getResolverMethod(MessengerResolver.prototype, methodName);
      const guards = Reflect.getMetadata(GUARDS_METADATA, resolverMethod) as unknown[];
      expect(guards).toContain(WebSocketAuthGuard);
    }
  });
});
