import { UnauthorizedException } from '@nestjs/common';

export function extractBearerToken(authHeader?: string): string {
  if (!authHeader) {
    throw new UnauthorizedException('No token provided');
  }

  const [authType, token] = authHeader.split(' ');

  if (authType !== 'Bearer' || !token) {
    throw new UnauthorizedException('Invalid token format');
  }

  return token;
}
