import { BadRequestException } from '@nestjs/common';
import { Restaurant, RestaurantStatus } from 'src/entities/restaurant.entity';
import { type CachePort } from 'src/infra/contracts/cache.port';
import { DeepPartial } from 'typeorm';
import { RestaurantProfileService } from './restaurant-profile.service';

describe('RestaurantProfileService', () => {
  const repository = {
    create: jest.fn((value: DeepPartial<Restaurant>): Restaurant => value as Restaurant),
    save: jest.fn(
      (value: Restaurant): Promise<Restaurant> =>
        Promise.resolve({ ...value, id: 'restaurant-1' } as Restaurant),
    ),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
  };
  const identityReader = { findIdentityUser: jest.fn() };
  const locationWriter = {
    writeAddress: jest.fn(),
    modifyAddress: jest.fn(),
    removeAddress: jest.fn(),
  };
  const storagePort = { upload: jest.fn(), deleteFile: jest.fn() };
  const cache: CachePort = {
    remember: <Value>(_key: string, _ttl: number, loader: () => Promise<Value>): Promise<Value> =>
      loader(),
    deleteByPattern: (): Promise<number> => Promise.resolve(0),
  };
  const service = new RestaurantProfileService(
    repository as never,
    identityReader,
    locationWriter,
    storagePort,
    cache,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    identityReader.findIdentityUser.mockResolvedValue({ userId: 'owner-from-jwt', isActive: true });
    locationWriter.writeAddress.mockResolvedValue({ addressId: 'address-1' });
  });

  it('uses the authenticated actor as owner and always creates a pending request', async () => {
    const saved = await service.requestRestaurantWithFiles('owner-from-jwt', {
      name: 'Quán thử nghiệm',
      addressStreet: '1 Đường A',
      addressWard: 'Phường 1',
      addressDistrict: 'Quận 1',
      addressCity: 'Hồ Chí Minh',
    });

    expect(identityReader.findIdentityUser).toHaveBeenCalledWith('owner-from-jwt');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: { id: 'owner-from-jwt' },
        address: { id: 'address-1' },
        status: RestaurantStatus.PENDING,
      }),
    );
    expect(saved.owner).toEqual({ id: 'owner-from-jwt' });
  });

  it('rejects onboarding when the authenticated account is inactive', async () => {
    identityReader.findIdentityUser.mockResolvedValue({
      userId: 'owner-from-jwt',
      isActive: false,
    });

    await expect(
      service.requestRestaurantWithFiles('owner-from-jwt', {
        name: 'Quán thử nghiệm',
        addressStreet: '1 Đường A',
        addressWard: 'Phường 1',
        addressDistrict: 'Quận 1',
        addressCity: 'Hồ Chí Minh',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(locationWriter.writeAddress).not.toHaveBeenCalled();
  });
});
