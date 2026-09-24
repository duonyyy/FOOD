import { ShipperProfile } from 'src/entities/shipperProfile.entity';
import { ShipperProfileService } from 'src/features/delivery/services/shipper/shipper-profile.service';

describe('ShipperProfileService boundary', () => {
  const profileRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
  const identityUserProfile = {
    findProfile: jest.fn(),
    updateProfile: jest.fn(),
  };
  const users = { createShipperAccount: jest.fn() };
  const manager = { getRepository: jest.fn() };
  const dataSource = {
    transaction: jest.fn(async (callback: (value: typeof manager) => Promise<unknown>) =>
      callback(manager),
    ),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes identity and delivery-owned profile fields through their owners', async () => {
    const profile = Object.assign(new ShipperProfile(), {
      userId: 'shipper-1',
      cccd: null,
      driverLicense: null,
    });
    profileRepository.findOne.mockResolvedValue(profile);
    profileRepository.save.mockResolvedValue(profile);
    identityUserProfile.updateProfile.mockResolvedValue({ userId: 'shipper-1' });
    const service = new ShipperProfileService(
      profileRepository as never,
      identityUserProfile as never,
      users as never,
      dataSource as never,
    );

    await service.updateDriverProfile('shipper-1', {
      name: 'Shipper A',
      phone: '0911',
      cccd: 'cccd-1',
      driverLicense: 'license-1',
    });

    expect(identityUserProfile.updateProfile).toHaveBeenCalledWith(
      'shipper-1',
      expect.objectContaining({ name: 'Shipper A', phone: '0911' }),
    );
    expect(profileRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ cccd: 'cccd-1', driverLicense: 'license-1' }),
    );
  });

  it('writes account and profile with the same transaction manager', async () => {
    const profile = Object.assign(new ShipperProfile(), {
      userId: 'shipper-1',
      cccd: 'cccd-1',
      driverLicense: 'B1',
      certificateStatus: 'PENDING',
    });
    const transactionalProfiles = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue(profile),
      save: jest.fn().mockResolvedValue(profile),
    };
    manager.getRepository.mockReturnValue(transactionalProfiles);
    users.createShipperAccount.mockResolvedValue({ id: 'shipper-1' });
    const service = new ShipperProfileService(
      profileRepository as never,
      identityUserProfile as never,
      users as never,
      dataSource as never,
    );

    await expect(
      service.registerPending({
        username: '0901234567',
        password: 'password123',
        name: 'Shipper',
        phone: '0901234567',
        birthday: new Date('1999-01-01'),
        cccd: 'cccd-1',
        driverLicense: 'B1',
      }),
    ).resolves.toEqual({ userId: 'shipper-1' });
    expect(users.createShipperAccount).toHaveBeenCalledWith(
      expect.objectContaining({ username: '0901234567' }),
      manager,
    );
    expect(manager.getRepository).toHaveBeenCalledWith(ShipperProfile);
    expect(transactionalProfiles.save).toHaveBeenCalledTimes(1);
    expect(profileRepository.save).not.toHaveBeenCalled();
    expect(users.createShipperAccount.mock.invocationCallOrder[0]).toBeLessThan(
      transactionalProfiles.save.mock.invocationCallOrder[0],
    );
  });

  it('propagates profile failure out of the transaction', async () => {
    const transactionalProfiles = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue({ userId: 'shipper-1' }),
      save: jest.fn().mockRejectedValue(new Error('profile database unavailable')),
    };
    manager.getRepository.mockReturnValue(transactionalProfiles);
    users.createShipperAccount.mockResolvedValue({ id: 'shipper-1' });
    const service = new ShipperProfileService(
      profileRepository as never,
      identityUserProfile as never,
      users as never,
      dataSource as never,
    );

    await expect(
      service.registerPending({
        username: '0901234567',
        password: 'password123',
        name: 'Shipper',
        phone: '0901234567',
        birthday: new Date('1999-01-01'),
      }),
    ).rejects.toThrow('profile database unavailable');
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(profileRepository.save).not.toHaveBeenCalled();
  });
});
