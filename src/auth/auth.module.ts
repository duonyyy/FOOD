import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from 'src/entities/address.entity';
import { Permission } from 'src/entities/permission.entity';
import { Role } from 'src/entities/role.entity';
import { ShipperCertificateInfo } from 'src/entities/shipperCertificateInfo.entity';
import { User } from 'src/entities/user.entity';
import { MailModule } from 'src/infra/mail/mail.module';
import { RoleModule } from 'src/modules/role/role.module';
import { UsersModule } from 'src/modules/users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { OtpService } from './services/otp.service';
import { PasswordResetService } from './services/password-reset.service';
import { SocialAuthService } from './services/social-auth.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, Permission, Address, ShipperCertificateInfo]),
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
  ],
  exports: [AuthService, AuthGuard, RolesGuard, JwtModule, UsersModule],
})
export class AuthModule {}
