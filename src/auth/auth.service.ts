import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from 'src/modules/users/users.service';
import { CreateUserDto } from 'src/modules/users/dto/create-users.dto';
import { RolesService } from 'src/modules/role/role.service';
import { DefaultRole, Role } from '../entities/role.entity';
import { RegisterDto } from './dto/register-user.dto';
import { GoogleRegisterDto } from './dto/google-register.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { UserResponse } from 'src/modules/users/interface/user-response.interface';
import { log } from 'console';
import { CreateShipperDto } from './dto/create-shipper.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/entities/user.entity';
import { CertificateStatus, ShipperCertificateInfo } from 'src/entities/shipperCertificateInfo.entity';
import { Repository } from 'typeorm';
import { nanoid } from 'nanoid/non-secure';
import { MailingService } from 'src/nodemailer/send-mail.service';
import { ResetPasswordDto } from './dto/reset-password.dto';
import * as crypto from 'crypto';


export enum AuthProvider {
  EMAIL = 'email',
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
}
interface LoginInput {
  email: string;
  password?: string; // Optional for provider-based login
  googleId?: string; // Optional for Google login
}


interface AuthResponse {
  message: string;
  user?: UserResponse;
  token?: string;
  isNewUser?: boolean;
  success?: boolean; // For simple success messages like logout/forgot password
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_SALT_ROUNDS = 10; // Số vòng lặp để tạo salt cho bcrypt
  private readonly JWT_EXPIRATION = '1d'; // Thời gian hết hạn của token JWT
  private readonly RESET_TOKEN_EXPIRATION_MINUTES = 60; // Thời gian hết hạn của token reset password (phút)

  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailingService,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(ShipperCertificateInfo)
    private readonly certRepo: Repository<ShipperCertificateInfo>,

    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) { }

  // Lưu trữ OTP tạm thời trong bộ nhớ (cần thay thế bằng Redis hoặc DB trong môi trường production)
  private otpStore = new Map<string, string>();

  /**
   * Gửi mã OTP xác thực số điện thoại
   * @param phone Số điện thoại cần gửi OTP
   * @returns Thông báo gửi thành công (giả lập)
   */
  async sendOtp(phone: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Tạo mã OTP 6 số ngẫu nhiên
    this.otpStore.set(phone, otp); // Lưu OTP vào bộ nhớ

    console.log(`Sending OTP to ${phone}: ${otp}`); // Log OTP ra console (chỉ dùng cho debug)
    this.logger.log(`OTP for ${phone}: ${otp}`);

    return { message: 'OTP sent successfully (simulated)' };
  }

  /**
   * Xác thực mã OTP người dùng nhập vào
   * @param phone Số điện thoại
   * @param otp Mã OTP cần kiểm tra
   * @returns Thông báo xác thực thành công hoặc lỗi
   */
  async verifyOtp(phone: string, otp: string) {
    const storedOtp = this.otpStore.get(phone);
    if (!storedOtp || storedOtp !== otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    this.otpStore.delete(phone); // Xóa OTP sau khi đã sử dụng
    return { message: 'OTP verified successfully' };
  }

  /**
   * Tìm hoặc tạo vai trò mới nếu chưa tồn tại
   * @param name Tên vai trò (Role)
   * @returns Role entity
   */
  async findByName(name: string): Promise<Role> {
    // Kiểm tra xem tên role có hợp lệ không
    if (!Object.values(DefaultRole).includes(name as DefaultRole)) {
      throw new Error(`Invalid role name: ${name}`);
    }

    // Tìm role trong database
    let role = await this.roleRepo.findOne({
      where: { name: name as DefaultRole },
    });

    // Nếu chưa có thì tạo mới
    if (!role) {
      role = this.roleRepo.create({ name: name as DefaultRole });
      role = await this.roleRepo.save(role);
    }

    return role;
  }

  /**
   * Tạo phản hồi chuẩn hóa cho User sau khi login/register thành công
   * @param user - Entity User
   * @param isNewUser - Cờ đánh dấu user mới tạo
   * @returns Object chứa thông tin user và quyền hạn
   */
  private async createUserResponse(
    user: any,
    isNewUser: boolean = false,
  ): Promise<any> {
    // Lấy danh sách quyền (permissions) của user dựa trên role
    const permissions = await this.rolesService.getUserPermissions(
      user.role.id,
      true,
    );
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
  async loginWithEmailPassword(email: string, password: string): Promise<any> {
    try {
      // Tìm user theo email
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        throw new BadRequestException('Invalid email or password');
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
      const permissions = await this.rolesService.getUserPermissions(
        user.role.id,
        true,
      );

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions,
        },
        token,
        message: 'Login successful',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        'Email/password authentication failed: ' + error.message,
      );
    }
  }

  /**
   * Đăng xuất user (hiện tại chỉ là log, client cần xóa token)
   * @param userId 
   */
  async logout(userId: string): Promise<any> {
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
    const existing = await this.userRepo.findOne({
      where: { username: dto.username },
    });
    if (existing) {
      throw new BadRequestException('Số điện thoại đã được sử dụng');
    }

    // Lấy role shipper
    const role = await this.rolesService.findByName(DefaultRole.SHIPPER);
    if (!role) {
      throw new BadRequestException('Vai trò shipper chưa được khởi tạo');
    }

    // Tạo ID cho tài xế
    const driverID = uuidv4().substring(0, 28);
    this.logger.log(`Generated driver ID: ${driverID}`);

    // Tạo user mới
    const user = this.userRepo.create({
      id: driverID,
      username: dto.username,
      password: await bcrypt.hash(dto.password, this.BCRYPT_SALT_ROUNDS),
      name: dto.name,
      phone: dto.phone,
      birthday: new Date(dto.birthday),
      role,
      isActive: true,

    });

    await this.userRepo.save(user);

    // Lưu thông tin chứng chỉ/bằng lái của tài xế và đặt trạng thái là PENDING (chờ duyệt)
    const cert = this.certRepo.create({
      user,
      cccd: dto.cccd,
      driverLicense: dto.driverLicense,
      status: CertificateStatus.PENDING,
    });

    await this.certRepo.save(cert);

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

    if (!user) return false;
    // Kiểm tra role là shipper và có thông tin chứng chỉ
    return user.role?.name === DefaultRole.SHIPPER && !!user.shipperCertificateInfo;
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
    console.log('User found:', user);
    console.log('User role:', user?.role?.name);
    console.log('Shipper certificate info:', user?.shipperCertificateInfo);

    if (!user || user.role?.name !== DefaultRole.SHIPPER || !user.shipperCertificateInfo) {
      return { exists: false };
    }

    return {
      exists: true,
      status: user.shipperCertificateInfo?.status.toLowerCase() as 'pending' | 'approved' | 'rejected',
    };
  }

  /**
   * Đăng nhập dành cho tài xế
   * @param username Tên đăng nhập (thường là sđt)
   * @param password Mật khẩu
   * @returns Token và thông tin user nếu đăng nhập thành công
   */
  async loginDriver(username: string, password: string): Promise<any> {
    const user = await this.userRepo.findOne({
      where: { username },
      relations: ['shipperCertificateInfo', 'role'], // Load kèm thông tin chứng chỉ và role
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Kiểm tra mật khẩu
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Kiểm tra thông tin shipper
    const shipperInfo = user.shipperCertificateInfo;
    if (!shipperInfo) {
      throw new UnauthorizedException('You are not registered as a driver');
    }

    // Kiểm tra trạng thái duyệt
    if (shipperInfo.status === CertificateStatus.PENDING) {
      return { status: 'pending', message: 'Your account is under review' };
    }

    if (shipperInfo.status === CertificateStatus.REJECTED) {
      return { status: 'rejected', message: 'Your registration has been rejected' };
    }

    // Trường hợp được duyệt (APPROVED) → cấp token truy cập
    const payload = {
      sub: user.id,
      username: user.username,
      roles: [user.role.name],
    };
    const access_token = await this.jwtService.signAsync(payload,
      {
        expiresIn: '1d', // Token hết hạn sau 1 ngày
      }
    );

    return {
      status: 'approved',
      access_token,
      user: {
        id: user.id,
        username: user.username,
        phone: user.phone,
      },
    };
  }

  /**
   * Tìm user theo số điện thoại
   * @param phone 
   * @returns User entity hoặc null
   */
  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { phone },
      relations: ['role', 'shipperCertificateInfo'],
    });
  }

  /**
   * Đăng ký tài khoản người dùng thông thường (Customer)
   * @param registerDto 
   * @returns User response
   */
  async register(registerDto: RegisterDto): Promise<any> {
    const { email, password, name } = registerDto;

    try {
      // Kiểm tra email đã tồn tại chưa
      const existingUser = await this.usersService.findByEmail(email);
      if (existingUser) {
        throw new BadRequestException('Email already exists');
      }

      // Lấy role mặc định cho user (Customer)
      const role = await this.rolesService.getRoleByName(
        DefaultRole.USER,
      );
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
          provider: AuthProvider.EMAIL,
        } as CreateUserDto,
        email,
      );

      return await this.createUserResponse(user, true);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Registration failed: ' + error.message);
    }
  }

  /**
   * Đăng ký hoặc Đăng nhập bằng Google
   * - Nếu email đã tồn tại: Liên kết tài khoản Google (nếu chưa) và đăng nhập
   * - Nếu email chưa tồn tại: Tạo tài khoản mới với provider là Google
   * @param googleDto 
   * @returns User response và token
   */
  async registerWithGoogle(googleDto: GoogleRegisterDto): Promise<any> {
    const { googleId, email, name /*, accessToken */ } = googleDto; // accessToken có thể dùng để gọi Google API nếu cần

    try {
      let user = await this.usersService.findByEmail(email);
      let isNewUser = false;

      if (user) {
        // User đã tồn tại -> Xử lý đăng nhập hoặc liên kết tài khoản
        this.logger.log(
          `Email ${email} already exists. Attempting to link or log in with Google.`,
        );

        // Nếu user chưa có provider Google hoặc chưa có googleId
        if (user.authProvider !== AuthProvider.GOOGLE || !user.googleId) {
          // Cập nhật provider và googleId cho user
          user = await this.usersService.updateUserProvider(user.id, {
            provider: AuthProvider.GOOGLE,
            googleId: googleId,
          });
          this.logger.log(`Linked Google ID ${googleId} to user ${user.id}`);
        } else if (user.googleId !== googleId) {
          // Trường hợp email tồn tại nhưng googleId khác -> có thể là lỗi hoặc tài khoản khác
          throw new BadRequestException(
            'Email associated with a different Google account.',
          );
        }
      } else {
        // User chưa tồn tại -> Đăng ký mới
        this.logger.log(`Registering new user with email ${email} via Google.`);
        isNewUser = true;
        const role = await this.rolesService.getRoleByName(
          DefaultRole.USER,
        );
        if (!role) {
          this.logger.error('Default subscriber role not found.');
          throw new BadRequestException('Default role not found');
        }

        // Tạo mật khẩu ngẫu nhiên (vì dùng Google login nên không cần pwd)
        const randomPassword = await bcrypt.hash(googleId + Date.now(), 10);
        const createUserDto: CreateUserDto = {
          username: email,
          email,
          name,
          password: randomPassword,
          role: role.id,
          authProvider: AuthProvider.GOOGLE,
          googleId,
          birthday: new Date(),
          // accessToken, 
        };
        const userId: string = uuidv4().substring(0, 28);
        user = await this.usersService.register(createUserDto, userId);
      }

      // Tạo JWT token
      const token = this.jwtService.sign(
        {
          sub: user.id,
          email: user.email,
          name: user.name,
          role: user.role.name,
          roleId: user.role.id,
        },
        {
          expiresIn: '1d',
        },
      );

      log(`Generated JWT token for user ${user.id}`);
      const userResponse = await this.createUserResponse(user, isNewUser);
      return {
        ...userResponse,
        token,
      };
    } catch (error) {
      this.logger.error(
        `Google registration/login failed for email ${email}: ${error.message}`,
        error.stack,
      );
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        'Google registration/login failed: ' + error.message,
      );
    }
  }

  /**
   * Khởi tạo quy trình quên mật khẩu: Tạo token reset và gửi email
   * @param email Email người dùng yêu cầu reset mật khẩu
   */
  async forgotPassword(email: string): Promise<any> {
    try {
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        // Vì lý do bảo mật, không thông báo user không tồn tại, chỉ báo đã gửi email nếu có
        return {
          message: 'If an account with this email exists, you will receive password reset instructions.',
          success: true,
        };
      }

      // Tạo token reset ngẫu nhiên
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpires = new Date(Date.now() + this.RESET_TOKEN_EXPIRATION_MINUTES * 60 * 1000); // Hết hạn sau 1 giờ

      // Lưu token vào user
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = resetTokenExpires;
      await this.userRepo.save(user);

      // Tạo link reset password (gửi kèm token và email)
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

      // Tạo nội dung email
      const emailContent = this.createPasswordResetEmailContent(user.name || 'User', resetUrl);

      // Gửi email
      await this.mailService.sendEmail({
        from: process.env.PROJECT_EMAIL || 'noreply@fooddie.com',
        to: email,
        subject: 'Password Reset Request - Fooddie',
        sender: 'Fooddie Support',
        bodyHtml: emailContent
      });

      this.logger.log(`Password reset email sent to: ${email}`);

      return {
        message: 'If an account with this email exists, you will receive password reset instructions.',
        success: true,
      };
    } catch (error) {
      this.logger.error(`Failed to send password reset email: ${error.message}`);
      throw new BadRequestException('Failed to process password reset request');
    }
  }

  /**
   * Đặt lại mật khẩu mới sử dụng token hợp lệ
   * @param resetPasswordDto Chứa token, email và password mới
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<any> {
    const { token, email, newPassword } = resetPasswordDto;

    try {
      // Tìm user với token khớp
      const user = await this.userRepo.findOne({
        where: {
          email,
          resetPasswordToken: token,
        }
      });

      if (!user) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      // Kiểm tra thời gian hết hạn của token
      if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
        throw new BadRequestException('Reset token has expired');
      }

      // Hash mật khẩu mới
      const hashedPassword = await bcrypt.hash(newPassword, this.BCRYPT_SALT_ROUNDS);

      // Cập nhật mật khẩu và xóa token reset
      user.password = hashedPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = new Date();
      await this.userRepo.save(user);

      // Gửi email xác nhận đổi mật khẩu thành công
      await this.sendPasswordChangeConfirmationEmail(user.email, user.name || 'User');

      this.logger.log(`Password reset successful for user: ${email}`);

      return {
        message: 'Password has been reset successfully',
        success: true,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Password reset failed: ${error.message}`);
      throw new BadRequestException('Failed to reset password');
    }
  }

  /**
   * Kiểm tra tính hợp lệ của token reset mật khẩu (dùng khi user click vào link từ email)
   */
  async verifyResetToken(token: string, email: string): Promise<any> {
    try {
      const user = await this.userRepo.findOne({
        where: {
          email,
          resetPasswordToken: token,
        }
      });

      if (!user) {
        return { valid: false, message: 'Invalid reset token' };
      }

      if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
        return { valid: false, message: 'Reset token has expired' };
      }

      return {
        valid: true,
        message: 'Token is valid',
        expiresAt: user.resetPasswordExpires
      };
    } catch (error) {
      this.logger.error(`Token verification failed: ${error.message}`);
      return { valid: false, message: 'Token verification failed' };
    }
  }

  /**
   * Tạo nội dung HTML cho email reset mật khẩu
   */
  private createPasswordResetEmailContent(userName: string, resetUrl: string): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - Fooddie</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ff6b35; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background-color: #f9f9f9; }
            .button { 
                display: inline-block; 
                background-color: #ff6b35; 
                color: white; 
                padding: 12px 30px; 
                text-decoration: none; 
                border-radius: 5px; 
                margin: 20px 0;
            }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🍕 Fooddie</h1>
                <h2>Password Reset Request</h2>
            </div>
            
            <div class="content">
                <h3>Hello ${userName},</h3>
                
                <p>We received a request to reset your password for your Fooddie account. If you didn't make this request, you can safely ignore this email.</p>
                
                <p>To reset your password, click the button below:</p>
                
                <div style="text-align: center;">
                    <a href="${resetUrl}" class="button">Reset My Password</a>
                </div>
                
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; background-color: #f0f0f0; padding: 10px; border-radius: 3px;">
                    ${resetUrl}
                </p>
                
                <div class="warning">
                    <strong>⚠️ Important:</strong>
                    <ul>
                        <li>This link will expire in 1 hour for security reasons</li>
                        <li>You can only use this link once</li>
                        <li>If you didn't request this reset, please ignore this email</li>
                    </ul>
                </div>
                
                <p>If you're having trouble with the button above, copy and paste the URL into your web browser.</p>
                
                <p>Best regards,<br>The Fooddie Team</p>
            </div>
            
            <div class="footer">
                <p>This email was sent to ${userName} because a password reset was requested for your Fooddie account.</p>
                <p>© ${new Date().getFullYear()} Fooddie. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Gửi email xác nhận sau khi đổi mật khẩu thành công
   */
  private async sendPasswordChangeConfirmationEmail(email: string, userName: string): Promise<void> {
    const emailContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Changed - Fooddie</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background-color: #f9f9f9; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .success { background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🍕 Fooddie</h1>
                <h2>Password Successfully Changed</h2>
            </div>
            
            <div class="content">
                <h3>Hello ${userName},</h3>
                
                <div class="success">
                    <strong>✅ Success!</strong> Your password has been successfully changed.
                </div>
                
                <p>Your Fooddie account password was recently changed on ${new Date().toLocaleString()}.</p>
                
                <p>If you made this change, no further action is required.</p>
                
                <p><strong>If you did not make this change:</strong></p>
                <ul>
                    <li>Your account may have been compromised</li>
                    <li>Please contact our support team immediately</li>
                </ul>
                
                <p>Best regards,<br>The Fooddie Team</p>
            </div>
            
            <div class="footer">
                <p>© ${new Date().getFullYear()} Fooddie. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
      await this.mailService.sendEmail({
        from: process.env.PROJECT_EMAIL || 'noreply@fooddie.com',
        to: email,
        subject: 'Password Successfully Changed - Fooddie',
        sender: 'Fooddie Support',
        bodyHtml: emailContent
      });
    } catch (error) {
      this.logger.error(`Failed to send password change confirmation: ${error.message}`);
      // Không ném lỗi để tránh ảnh hưởng luồng chính vì password đã đổi thành công rồi
    }
  }
}
