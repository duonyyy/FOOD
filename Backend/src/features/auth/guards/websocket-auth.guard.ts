import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import { type GraphqlSubscriptionContext } from '../contracts/graphql-subscription-context';
import { extractBearerToken } from '../utils/auth-token.util';

interface JwtPayload {
  sub: string;
  [key: string]: unknown;
}

@Injectable()
export class WebSocketAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext<GraphqlSubscriptionContext>();

    const connectionContext = ctx.connection?.context;
    if (!connectionContext) {
      throw new UnauthorizedException('WebSocket connection required');
    }

    const authHeader = connectionContext.headers?.authorization || connectionContext.Authorization;
    const token = extractBearerToken(authHeader);

    try {
      // Use EXACTLY the same verification as AuthGuard
      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      if (!jwtSecret) {
        throw new Error('JWT_SECRET is not configured');
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: jwtSecret,
      });

      // Attach the payload to the connection context (same as AuthGuard does to request)
      connectionContext.user = { ...payload, id: payload.sub, uid: payload.sub };

      return true;
    } catch (_error: unknown) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
