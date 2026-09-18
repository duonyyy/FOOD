import { ShipperProfile } from 'src/entities/shipperProfile.entity';
import { ShipperProfileService } from 'src/features/delivery/services/shipper/shipper-profile.service';

describe('ShipperProfileService boundary', () => {
  const profileRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const identityUserProfile = {
    findProfile: jest.fn(),
    updateProfile: jest.fn(),
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
});
