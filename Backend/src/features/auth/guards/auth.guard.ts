import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { extractBearerToken } from '../utils/auth-token.util';

interface JwtPayload {
  sub: string;
  [key: string]: unknown;
}

interface RequestWithAuth {
  headers: { authorization?: string };
  user?: JwtPayload & { id: string; uid: string };
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const token = extractBearerToken(request.headers.authorization);

    try {
      //this.logger.log('Verifying token...');
      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      if (!jwtSecret) {
        throw new Error('JWT_SECRET is not configured');
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: jwtSecret,
      });
      //this.logger.log('Token verified successfully:', payload);

      // Attach the payload to the request object
      request.user = { ...payload, id: payload.sub, uid: payload.sub };
      return true;
    } catch (error: unknown) {
      this.logger.error(
        `Token verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
