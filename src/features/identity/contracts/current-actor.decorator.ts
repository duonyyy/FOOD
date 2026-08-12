import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export interface CurrentActor {
  userId: string;
}

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentActor => {
    const request = context.switchToHttp().getRequest<{ user?: Record<string, unknown> }>();
    const actorId = request.user?.id ?? request.user?.uid ?? request.user?.sub;

    if (typeof actorId !== 'string' || actorId.length === 0) {
      throw new UnauthorizedException('Authenticated actor is missing');
    }

    return { userId: actorId };
  },
);
