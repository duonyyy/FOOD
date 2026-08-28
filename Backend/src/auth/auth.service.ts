import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import {
  CertificateStatus,
  ShipperCertificateInfo,
} from 'src/entities/shipperCertificateInfo.entity';
import { User } from 'src/entities/user.entity';
import { RolesService } from 'src/modules/role/role.service';
import { CreateUserDto } from 'src/modules/users/dto/create-users.dto';
import { UsersService } from 'src/modules/users/users.service';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { DefaultRole, Role } from '../entities/role.entity';
import { CreateShipperDto } from './dto/create-shipper.dto';
import { GoogleRegisterDto } from './dto/google-register.dto';
import { RegisterDto } from './dto/register-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthProvider } from './enums/auth-provider.enum';
import { OtpService } from './services/otp.service';
import { PasswordResetService } from './services/password-reset.service';
import { SocialAuthService } from './services/social-auth.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_SALT_ROUNDS = 10; // Số vòng lặp để tạo salt cho bcrypt
  private readonly JWT_EXPIRATION = '1d'; // Thời gian hết hạn của token JWT

  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpService,
    private readonly passwordResetService: PasswordResetService,
    private readonly socialAuthService: SocialAuthService,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(ShipperCertificateInfo)
    private readonly certRepo: Repository<ShipperCertificateInfo>,

    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
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
  private async createUserResponse(user: any, isNewUser: boolean = false): Promise<any> {
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
  async loginWithEmailPassword(email: string, password: string): Promise<any> {
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
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Email/password authentication failed: ' + error.message);
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

    if (!user || user.role?.name !== DefaultRole.SHIPPER || !user.shipperCertificateInfo) {
      return { exists: false };
    }

    return {
      exists: true,
      status: user.shipperCertificateInfo?.status.toLowerCase() as
        | 'pending'
        | 'approved'
        | 'rejected',
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

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
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
    return this.socialAuthService.registerWithGoogle(googleDto);
  }

  /**
   * Khởi tạo quy trình quên mật khẩu: Tạo token reset và gửi email
   * @param email Email người dùng yêu cầu reset mật khẩu
   */
  async forgotPassword(email: string): Promise<any> {
    return this.passwordResetService.forgotPassword(email);
  }

  /**
   * Đặt lại mật khẩu mới sử dụng token hợp lệ
   * @param resetPasswordDto Chứa token, email và password mới
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<any> {
    return this.passwordResetService.resetPassword(resetPasswordDto);
  }

  /**
   * Kiểm tra tính hợp lệ của token reset mật khẩu (dùng khi user click vào link từ email)
   */
  async verifyResetToken(token: string, email: string): Promise<any> {
    return this.passwordResetService.verifyResetToken(token, email);
  }
}
