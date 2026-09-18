import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ShipperProfileModule } from 'src/features/delivery/shipper-profile.public-api';
import { RoleModule, UsersModule } from 'src/features/users/identity-auth-modules.public-api';
import { MailModule } from 'src/infra/mail/public-api';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { WebSocketAuthGuard } from './guards/websocket-auth.guard';
import { OtpService } from './services/otp.service';
import { PasswordResetService } from './services/password-reset.service';
import { SocialAuthService } from './services/social-auth.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '1d'),
        },
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    ShipperProfileModule,
    RoleModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    PasswordResetService,
    SocialAuthService,
    AuthGuard,
    RolesGuard,
    WebSocketAuthGuard,
  ],
  exports: [AuthService, AuthGuard, RolesGuard, WebSocketAuthGuard, JwtModule],
})
export class AuthModule {}
