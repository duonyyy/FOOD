import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { ShipperProfileService } from 'src/features/delivery/shipper-profile.public-api';
import {
  CreateUserDto,
  RolesService,
  UsersService,
} from 'src/features/users/identity-auth.public-api';
import { DefaultRole } from 'src/shared/types/enums/default-role.enum';
import { CreateShipperDto } from './dto/create-shipper.dto';
import { GoogleRegisterDto } from './dto/google-register.dto';
import { RegisterDto } from './dto/register-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthProvider } from 'src/shared/types/enums/auth-provider.enum';
import { OtpService } from './services/otp.service';
import { PasswordResetService } from './services/password-reset.service';
import { SocialAuthService } from './services/social-auth.service';

type AuthResponse = Record<string, unknown>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly JWT_EXPIRATION = '1d'; // Thời gian hết hạn của token JWT

  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpService,
    private readonly passwordResetService: PasswordResetService,
    private readonly socialAuthService: SocialAuthService,

    private readonly shipperProfileReader: ShipperProfileService,

    private readonly shipperProfileCommands: ShipperProfileService,
  ) {}

  /**
   * Gửi mã OTP xác thực số điện thoại
   * @param phone Số điện thoại cần gửi OTP
   * @returns Thông báo gửi thành công (giả lập)
   */
  async sendOtp(phone: string) {
    return this.otpService.sendOtp(phone);
  }

  /**
   * Xác thực mã OTP người dùng nhập vào
   * @param phone Số điện thoại
   * @param otp Mã OTP cần kiểm tra
   * @returns Thông báo xác thực thành công hoặc lỗi
   */
  async verifyOtp(phone: string, otp: string) {
    return this.otpService.verifyOtp(phone, otp);
  }

  /**
   * Tạo phản hồi chuẩn hóa cho User sau khi login/register thành công
   * @param user - Entity User
   * @param isNewUser - Cờ đánh dấu user mới tạo
   * @returns Object chứa thông tin user và quyền hạn
   */
  private async createUserResponse(
    user: Awaited<ReturnType<UsersService['register']>>,
    isNewUser = false,
  ): Promise<AuthResponse> {
    // Lấy danh sách quyền (permissions) của user dựa trên role
    const permissions = await this.rolesService.getUserPermissions(user.role.id, true);
    return {
      message: isNewUser ? 'Registration successful' : 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name, // Trả về tên role
        permissions, // Trả về danh sách quyền
      },
      isNewUser, // Trả về flag user mới
    };
  }

  /**
   * Đăng nhập bằng Email và Password
   * @param email
   * @param password
   * @returns Token JWT và thông tin user
   */
  async loginWithEmailPassword(email: string, password: string): Promise<AuthResponse> {
    try {
      // Tìm user theo email
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        throw new BadRequestException('Invalid email or password');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Account is inactive');
      }

      // Kiểm tra mật khẩu
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new BadRequestException('Invalid email or password');
      }

      // Tạo payload cho JWT token
      const token = this.jwtService.sign(
        {
          sub: user.id,
          email: user.email,
          name: user.name,
          role: user.role.name,
          roleId: user.role.id,
        },
        {
          expiresIn: this.JWT_EXPIRATION,
        },
      );

      // Lấy quyền của user
      const permissions = await this.rolesService.getUserPermissions(user.role.id, true);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions,
        },
        accessToken: token,
        token,
        message: 'Login successful',
      };
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Email/password authentication failed: ' + errorMessage(error));
    }
  }

  /**
   * Đăng xuất user (hiện tại chỉ là log, client cần xóa token)
   * @param userId
   */
  logout(userId: string): { message: string; success: boolean } {
    this.logger.log(`User logged out: ${userId}`);
    // Client cần tự xóa token khỏi storage

    return {
      message: 'User logged out successfully',
      success: true,
    };
  }

  /**
   * Đăng ký tài xế (Shipper)
   * @param dto Thông tin đăng ký shipper
   * @returns Thông báo và userId
   */
  async registerDriver(dto: CreateShipperDto) {
    // Kiểm tra username (số điện thoại) đã tồn tại chưa
    let user: Awaited<ReturnType<UsersService['createShipperAccount']>>;
    try {
      user = await this.usersService.createShipperAccount({
        username: dto.username,
        password: dto.password,
        name: dto.name,
        phone: dto.phone,
        birthday: new Date(dto.birthday),
      });
    } catch (error) {
      if ((error as Error).message === 'USERNAME_ALREADY_EXISTS') {
        throw new BadRequestException('Số điện thoại đã được sử dụng');
      }
      if ((error as Error).message === 'SHIPPER_ROLE_NOT_FOUND') {
        throw new BadRequestException('Vai trò shipper chưa được khởi tạo');
      }
      throw error;
    }

    // Delivery sở hữu hồ sơ/chứng chỉ; Auth chỉ tạo account và gọi public command.
    await this.shipperProfileCommands.createPending({
      userId: user.id,
      cccd: dto.cccd,
      driverLicense: dto.driverLicense,
    });

    return {
      message: 'Đăng ký tài xế thành công. Vui lòng chờ duyệt.',
      userId: user.id,
    };
  }

  /**
   * Kiểm tra số điện thoại đã tồn tại trong hệ thống chưa
   * @param phone
   * @returns true nếu đã tồn tại, false nếu chưa
   */
  async checkPhoneExists(phone: string): Promise<boolean> {
    const user = await this.usersService.findByPhone(phone);
    return !!user;
  }

  /**
   * Kiểm tra xem số điện thoại có phải là của Shipper không
   * @param phone
   * @returns true nếu là shipper và có thông tin chứng chỉ
   */
  async isShipperPhone(phone: string): Promise<boolean> {
    const user = await this.usersService.findByPhone(phone);

    if (!user || user.role?.name !== DefaultRole.SHIPPER) {
      return false;
    }

    return Boolean(await this.shipperProfileReader.findByUserId(user.id));
  }

  /**
   * Lấy trạng thái duyệt của Shipper dựa trên số điện thoại
   * @param phone
   * @returns Trạng thái đăng ký (pending, approved, rejected)
   */
  async getShipperStatusByPhone(phone: string): Promise<{
    exists: boolean;
    status?: 'pending' | 'approved' | 'rejected';
  }> {
    const user = await this.usersService.findByPhone(phone);

    if (!user || user.role?.name !== DefaultRole.SHIPPER) {
      return { exists: false };
    }

    const profile = await this.shipperProfileReader.findByUserId(user.id);
    if (!profile) {
      return { exists: false };
    }

    return {
      exists: true,
      status: profile.certificateStatus.toLowerCase() as 'pending' | 'approved' | 'rejected',
    };
  }

  /**
   * Đăng nhập dành cho tài xế
   * @param username Tên đăng nhập (thường là sđt)
   * @param password Mật khẩu
   * @returns Token và thông tin user nếu đăng nhập thành công
   */
  async loginDriver(username: string, password: string): Promise<AuthResponse> {
    const user = await this.usersService.findByUsernameWithRole(username);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Kiểm tra mật khẩu
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const shipperProfile = await this.shipperProfileReader.findByUserId(user.id);
    if (!shipperProfile) {
      throw new UnauthorizedException('You are not registered as a driver');
    }

    // Kiểm tra trạng thái duyệt
    if (shipperProfile.certificateStatus === 'PENDING') {
      return { status: 'pending', message: 'Your account is under review' };
    }

    if (shipperProfile.certificateStatus === 'REJECTED') {
      return { status: 'rejected', message: 'Your registration has been rejected' };
    }

    // Trường hợp được duyệt (APPROVED) → cấp token truy cập
    const payload = {
      sub: user.id,
      username: user.username,
      roles: [user.role.name],
    };
    const access_token = await this.jwtService.signAsync(payload, {
      expiresIn: '1d', // Token hết hạn sau 1 ngày
    });

    return {
      status: 'approved',
      accessToken: access_token,
      access_token,
      user: {
        id: user.id,
        username: user.username,
        phone: user.phone,
      },
    };
  }

  /**
   * Đăng ký tài khoản người dùng thông thường (Customer)
   * @param registerDto
   * @returns User response
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, name } = registerDto;

    try {
      // Kiểm tra email đã tồn tại chưa
      const existingUser = await this.usersService.findByEmail(email);
      if (existingUser) {
        throw new BadRequestException('Email already exists');
      }

      // Lấy role mặc định cho user (Customer)
      const role = await this.rolesService.getRoleByName(DefaultRole.USER);
      if (!role) {
        throw new BadRequestException('Default role not found');
      }

      // Tạo user mới
      const user = await this.usersService.register(
        {
          username: email,
          email,
          name,
          birthday: new Date(),
          role: role.id,
          password,
          authProvider: AuthProvider.EMAIL,
        } as CreateUserDto,
        email,
      );

      return await this.createUserResponse(user, true);
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Registration failed: ' + errorMessage(error));
    }
  }

  /**
   * Đăng ký hoặc Đăng nhập bằng Google
   * - Nếu email đã tồn tại: Liên kết tài khoản Google (nếu chưa) và đăng nhập
   * - Nếu email chưa tồn tại: Tạo tài khoản mới với provider là Google
   * @param googleDto
   * @returns User response và token
   */
  async registerWithGoogle(googleDto: GoogleRegisterDto): Promise<AuthResponse> {
    return (await this.socialAuthService.registerWithGoogle(googleDto)) as unknown as AuthResponse;
  }

  /**
   * Khởi tạo quy trình quên mật khẩu: Tạo token reset và gửi email
   * @param email Email người dùng yêu cầu reset mật khẩu
   */
  async forgotPassword(email: string): Promise<AuthResponse> {
    return (await this.passwordResetService.forgotPassword(email)) as AuthResponse;
  }

  /**
   * Đặt lại mật khẩu mới sử dụng token hợp lệ
   * @param resetPasswordDto Chứa token, email và password mới
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<AuthResponse> {
    return (await this.passwordResetService.resetPassword(resetPasswordDto)) as AuthResponse;
  }

  /**
   * Kiểm tra tính hợp lệ của token reset mật khẩu (dùng khi user click vào link từ email)
   */
  async verifyResetToken(token: string, email: string): Promise<AuthResponse> {
    return (await this.passwordResetService.verifyResetToken(
      token,
      email,
    )) as unknown as AuthResponse;
  }
}
