import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from 'src/entities/user.entity';
import { DefaultRole } from 'src/entities/role.entity';
import { initializeFirebaseAdmin } from 'src/config/firebase-admin.config';
import { CreateUserDto } from 'src/modules/users/dto/create-users.dto';
import { UsersService } from 'src/modules/users/users.service';
import { RolesService } from 'src/modules/role/role.service';
import { AuthProvider } from '../enums/auth-provider.enum';
import { GoogleRegisterDto } from '../dto/google-register.dto';

@Injectable()
export class SocialAuthService {
  private readonly logger = new Logger(SocialAuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async registerWithGoogle(googleDto: GoogleRegisterDto): Promise<any> {
    const decodedToken = await this.verifyFirebaseToken(googleDto.accessToken);
    const email = decodedToken.email;
    const googleId = decodedToken.uid;
    const name = decodedToken.name || googleDto.name || email;

    if (!email) {
      throw new BadRequestException('Verified Google account does not include an email');
    }

    try {
      let user = await this.usersService.findByEmail(email);
      let isNewUser = false;

      if (user) {
        if (user.authProvider !== AuthProvider.GOOGLE || !user.googleId) {
          user = await this.usersService.updateUserProvider(user.id, {
            provider: AuthProvider.GOOGLE,
            googleId,
          });
        } else if (user.googleId !== googleId) {
          throw new BadRequestException('Email associated with a different Google account.');
        }
      } else {
        isNewUser = true;
        const role = await this.rolesService.getRoleByName(DefaultRole.USER);
        if (!role) {
          throw new BadRequestException('Default role not found');
        }

        const randomPassword = await bcrypt.hash(`${googleId}:${Date.now()}`, 10);
        const createUserDto: CreateUserDto = {
          username: email,
          email,
          name,
          password: randomPassword,
          role: role.id,
          authProvider: AuthProvider.GOOGLE,
          googleId,
          birthday: new Date(),
        };
        user = await this.usersService.register(createUserDto, uuidv4().substring(0, 28));
      }

      return this.createGoogleAuthResponse(user, isNewUser);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Google registration/login failed for ${email}: ${(error as Error).message}`);
      throw new BadRequestException('Google registration/login failed');
    }
  }

  private async verifyFirebaseToken(accessToken: string) {
    if (!accessToken) {
      throw new BadRequestException('Google accessToken is required');
    }

    try {
      const app = initializeFirebaseAdmin(this.configService);
      return await app.auth().verifyIdToken(accessToken);
    } catch (error) {
      this.logger.warn(`Invalid Firebase ID token: ${(error as Error).message}`);
      throw new BadRequestException('Invalid Google token');
    }
  }

  private async createGoogleAuthResponse(user: User, isNewUser: boolean): Promise<any> {
    const permissions = await this.rolesService.getUserPermissions(user.role.id, true);
    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
        roleId: user.role.id,
      },
      {
        expiresIn: this.configService.get<string>('JWT_EXPIRATION', '1d'),
      },
    );

    return {
      message: isNewUser ? 'Registration successful' : 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
        permissions,
      },
      isNewUser,
      accessToken,
      token: accessToken,
    };
  }
}
