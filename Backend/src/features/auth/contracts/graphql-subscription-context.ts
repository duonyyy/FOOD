import { UnauthorizedException } from '@nestjs/common';

export interface GraphqlSubscriptionActor {
  id?: string;
  uid?: string;
  sub?: string;
}

export interface GraphqlSubscriptionConnectionContext {
  headers?: { authorization?: string; Authorization?: string };
  Authorization?: string;
  user?: GraphqlSubscriptionActor | null;
}

export interface GraphqlSubscriptionContext {
  connection?: { context?: GraphqlSubscriptionConnectionContext };
}

/** Returns the JWT-bound actor for an authenticated GraphQL WebSocket subscription. */
export function requireGraphqlSubscriptionActorId(context: GraphqlSubscriptionContext): string {
  const actor = context.connection?.context?.user;
  const actorId = actor?.id ?? actor?.uid ?? actor?.sub;

  if (!actorId) {
    throw new UnauthorizedException('Authenticated WebSocket user required');
  }

  return actorId;
}
