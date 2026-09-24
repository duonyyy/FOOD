import { UnauthorizedException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { AuthService } from 'src/features/auth/auth.service';
import type { CreateShipperDto } from 'src/features/auth/dto/create-shipper.dto';

describe('Shipper auth and Delivery profile boundary', () => {
  const users = {
    findByUsernameWithRole: jest.fn(),
  };
  const profiles = {
    registerPending: jest.fn(),
    findByUserId: jest.fn(),
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('driver-token') };
  const auth = new AuthService(
    users as never,
    {} as never,
    jwt as never,
    {} as never,
    {} as never,
    {} as never,
    profiles as never,
  );
  const registration: CreateShipperDto = {
    username: '0901234567',
    password: 'password123',
    name: 'Driver A',
    phone: '0901234567',
    birthday: '1999-01-01',
    cccd: '123456789012',
    driverLicense: 'B123456789',
  };

  beforeEach(() => jest.clearAllMocks());

  it('delegates registration to the transactional Delivery profile boundary', async () => {
    profiles.registerPending.mockResolvedValue({ userId: 'driver-1' });

    await expect(auth.registerDriver(registration)).resolves.toEqual({
      message: 'Đăng ký tài xế thành công. Vui lòng chờ duyệt.',
      userId: 'driver-1',
    });
    expect(profiles.registerPending).toHaveBeenCalledWith({
      username: registration.username,
      password: registration.password,
      name: registration.name,
      phone: registration.phone,
      birthday: new Date(registration.birthday),
      cccd: registration.cccd,
      driverLicense: registration.driverLicense,
    });
  });

  it('does not report success when transactional registration fails', async () => {
    profiles.registerPending.mockRejectedValue(new Error('profile database unavailable'));

    await expect(auth.registerDriver(registration)).rejects.toThrow('profile database unavailable');
    expect(profiles.registerPending).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing public validation errors from account creation', async () => {
    profiles.registerPending.mockRejectedValue(new Error('USERNAME_ALREADY_EXISTS'));
    await expect(auth.registerDriver(registration)).rejects.toThrow('Số điện thoại đã được sử dụng');
  });

  it('does not issue a driver token without an approved Delivery profile', async () => {
    users.findByUsernameWithRole.mockResolvedValue({
      id: 'driver-1',
      username: registration.username,
      phone: registration.phone,
      password: await hash(registration.password, 4),
      isActive: true,
      role: { name: 'shipper' },
    });
    profiles.findByUserId.mockResolvedValue(null);

    await expect(auth.loginDriver(registration.username, registration.password)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(jwt.signAsync).not.toHaveBeenCalled();

    profiles.findByUserId.mockResolvedValue({ certificateStatus: 'PENDING' });
    await expect(
      auth.loginDriver(registration.username, registration.password),
    ).resolves.toMatchObject({
      status: 'pending',
    });
    expect(jwt.signAsync).not.toHaveBeenCalled();

    profiles.findByUserId.mockResolvedValue({ certificateStatus: 'APPROVED' });
    await expect(
      auth.loginDriver(registration.username, registration.password),
    ).resolves.toMatchObject({
      status: 'approved',
      accessToken: 'driver-token',
    });
  });
});
