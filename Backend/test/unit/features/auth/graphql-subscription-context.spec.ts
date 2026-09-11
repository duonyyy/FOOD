import { UnauthorizedException } from '@nestjs/common';
import { requireGraphqlSubscriptionActorId } from 'src/features/auth/public-api';

describe('GraphQL subscription actor context', () => {
  it('returns the user attached by WebSocketAuthGuard', () => {
    expect(
      requireGraphqlSubscriptionActorId({
        connection: { context: { user: { id: 'customer-a' } } },
      }),
    ).toBe('customer-a');
  });

  it('accepts JWT compatibility fields when an id has not been normalized yet', () => {
    expect(
      requireGraphqlSubscriptionActorId({
        connection: { context: { user: { sub: 'customer-a' } } },
      }),
    ).toBe('customer-a');
  });

  it('rejects a subscription context without a JWT-bound actor', () => {
    expect(() => requireGraphqlSubscriptionActorId({})).toThrow(UnauthorizedException);
  });
});
