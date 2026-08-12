import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { estimateDeliveryTime, haversineDistance } from 'src/common/utils/geo.util';
import { Restaurant, RestaurantStatus } from 'src/entities/restaurant.entity';
import { IDENTITY_READER, type IdentityReaderPort } from 'src/features/identity/public-api';
import {
  LOCATION_WRITER,
  type CreateAddressPayload,
  type LocationWriterPort,
} from 'src/features/locations/public-api';
import { STORAGE_PORT, type StoragePort } from 'src/features/system-constraints/public-api';
import { CACHE_PORT, type CachePort } from 'src/infra/contracts/cache.port';
import { DeepPartial, Repository } from 'typeorm';
import { RequestRestaurantDto, UpdateOwnedRestaurantDto } from '../dto/restaurant-request.dto';

type RestaurantWithDistance = Restaurant & {
  distance: number | null;
  deliveryTime: number | null;
};

const RESTAURANT_CACHE_TTL_SECONDS = 60;

@Injectable()
export class RestaurantProfileService {
  private readonly logger = new Logger(RestaurantProfileService.name);

  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
    @Inject(IDENTITY_READER)
    private readonly identityReader: IdentityReaderPort,
    @Inject(LOCATION_WRITER)
    private readonly locationWriter: LocationWriterPort,
    @Inject(STORAGE_PORT)
    private readonly storagePort: StoragePort,
    @Inject(CACHE_PORT)
    private readonly cache: CachePort,
  ) {}

  async findOne(id: string): Promise<Restaurant> {
    const restaurant = await this.restaurantRepository.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }
    return restaurant;
  }

  async requestRestaurantWithFiles(
    ownerId: string,
    request: RequestRestaurantDto,
    avatarFile?: Express.Multer.File,
    backgroundFile?: Express.Multer.File,
    certificateFile?: Express.Multer.File,
  ): Promise<Restaurant> {
    const owner = await this.identityReader.findIdentityUser(ownerId);
    if (!owner || !owner.isActive) {
      throw new BadRequestException('Restaurant owner account is unavailable');
    }

    const addressData = this.toAddressPayload(request);
    const { addressId } = await this.locationWriter.writeAddress(addressData, owner.userId);
    const uploadedUrls: string[] = [];

    try {
      const avatar = await this.uploadOptional(avatarFile, 'restaurant-avatars', uploadedUrls);
      const backgroundImage = await this.uploadOptional(
        backgroundFile,
        'restaurant-backgrounds',
        uploadedUrls,
      );
      const certificateImage = await this.uploadOptional(
        certificateFile,
        'restaurant-certificates',
        uploadedUrls,
      );
      const fields = this.toCreateRestaurantFields(request);
      const restaurantPayload: DeepPartial<Restaurant> = {
        ...fields,
        latitude: this.toCoordinate(request.latitude, 'latitude'),
        longitude: this.toCoordinate(request.longitude, 'longitude'),
        avatar: avatar ?? request.avatar ?? '',
        backgroundImage: backgroundImage ?? request.backgroundImage ?? '',
        certificateImage: certificateImage ?? request.certificateImage ?? '',
        owner: { id: owner.userId },
        address: { id: addressId },
        status: RestaurantStatus.PENDING,
      };
      const restaurant = this.restaurantRepository.create(restaurantPayload);

      const saved = await this.restaurantRepository.save(restaurant);
      await this.clearRestaurantCache(saved.id, owner.userId);
      return saved;
    } catch (error) {
      await Promise.all(
        uploadedUrls.map((url) => this.storagePort.deleteFile(url).catch(() => undefined)),
      );
      throw error;
    }
  }

  async updateWithFiles(
    id: string,
    update: UpdateOwnedRestaurantDto,
    avatarFile?: Express.Multer.File,
    backgroundFile?: Express.Multer.File,
    certificateFile?: Express.Multer.File,
  ): Promise<Restaurant> {
    const restaurant = await this.findOne(id);
    const oldUrls = [restaurant.avatar, restaurant.backgroundImage, restaurant.certificateImage];
    const uploadedUrls: string[] = [];

    try {
      if (this.hasAddressChange(update)) {
        await this.updateRestaurantAddress(restaurant, update);
      }

      const avatar = await this.uploadOptional(avatarFile, 'restaurant-avatars', uploadedUrls);
      const backgroundImage = await this.uploadOptional(
        backgroundFile,
        'restaurant-backgrounds',
        uploadedUrls,
      );
      const certificateImage = await this.uploadOptional(
        certificateFile,
        'restaurant-certificates',
        uploadedUrls,
      );
      const fields = this.toRestaurantFields(update);
      Object.assign(restaurant, fields);
      if (avatar) restaurant.avatar = avatar;
      if (backgroundImage) restaurant.backgroundImage = backgroundImage;
      if (certificateImage) restaurant.certificateImage = certificateImage;

      const saved = await this.restaurantRepository.save(restaurant);
      await Promise.all([
        avatar ? this.deleteIfReplaced(oldUrls[0], avatar) : Promise.resolve(),
        backgroundImage ? this.deleteIfReplaced(oldUrls[1], backgroundImage) : Promise.resolve(),
        certificateImage ? this.deleteIfReplaced(oldUrls[2], certificateImage) : Promise.resolve(),
      ]);
      await this.clearRestaurantCache(saved.id, saved.owner?.id);
      return saved;
    } catch (error) {
      await Promise.all(
        uploadedUrls.map((url) => this.storagePort.deleteFile(url).catch(() => undefined)),
      );
      throw error;
    }
  }

  async update(id: string, update: UpdateOwnedRestaurantDto): Promise<Restaurant> {
    return this.updateWithFiles(id, update);
  }

  async findByOwnerId(
    ownerId: string,
    lat?: number,
    lng?: number,
  ): Promise<RestaurantWithDistance | null> {
    const cacheKey = this.cacheKey('restaurant:byOwner', { ownerId, lat, lng });
    return this.cache.remember(cacheKey, RESTAURANT_CACHE_TTL_SECONDS, async () => {
      const restaurant = await this.restaurantRepository.findOne({
        where: { owner: { id: ownerId } },
        relations: ['owner'],
      });
      return restaurant ? this.withDistance(restaurant, lat, lng) : null;
    });
  }

  async getRestaurantRequests(
    page = 1,
    pageSize = 10,
    lat?: number,
    lng?: number,
  ): Promise<{
    items: RestaurantWithDistance[];
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const [items, totalItems] = await this.restaurantRepository.findAndCount({
      where: { status: RestaurantStatus.PENDING },
      relations: ['owner'],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return this.toPage(
      items.map((item) => this.withDistance(item, lat, lng)),
      totalItems,
      page,
      pageSize,
    );
  }

  async deleteRestaurantRequest(id: string): Promise<void> {
    const restaurant = await this.findOne(id);
    if (restaurant.status !== RestaurantStatus.PENDING) {
      throw new BadRequestException('Only a pending restaurant request can be deleted');
    }
    await this.restaurantRepository.remove(restaurant);
    await this.clearRestaurantCache(id, restaurant.owner?.id);
  }

  async remove(id: string): Promise<void> {
    const restaurant = await this.findOne(id);
    await this.restaurantRepository.remove(restaurant);
    await this.clearRestaurantCache(id, restaurant.owner?.id);
  }

  private async updateRestaurantAddress(
    restaurant: Restaurant,
    update: UpdateOwnedRestaurantDto,
  ): Promise<void> {
    const address = this.toAddressPayload(update);
    if (restaurant.address?.id) {
      await this.locationWriter.modifyAddress(restaurant.address.id, address);
      return;
    }
    const { addressId } = await this.locationWriter.writeAddress(address, restaurant.owner?.id);
    restaurant.address = { id: addressId } as Restaurant['address'];
  }

  private toAddressPayload(
    input: RequestRestaurantDto | UpdateOwnedRestaurantDto,
  ): CreateAddressPayload {
    const splitAddress = input.address?.split(',').map((part) => part.trim());
    const street = input.addressStreet ?? splitAddress?.[0];
    const ward = input.addressWard ?? splitAddress?.[1];
    const district = input.addressDistrict ?? splitAddress?.[2];
    const city = input.addressCity ?? splitAddress?.[3];
    if (!street || !ward || !district || !city) {
      throw new BadRequestException(
        'Street, ward, district and city are required for a restaurant address',
      );
    }
    return {
      street,
      ward,
      district,
      city,
      latitude: this.toCoordinate(input.latitude, 'latitude'),
      longitude: this.toCoordinate(input.longitude, 'longitude'),
    };
  }

  private toRestaurantFields(update: UpdateOwnedRestaurantDto): Partial<Restaurant> {
    const fields = { ...update };
    const latitude = fields.latitude;
    const longitude = fields.longitude;
    delete fields.address;
    delete fields.addressStreet;
    delete fields.addressWard;
    delete fields.addressDistrict;
    delete fields.addressCity;
    delete fields.latitude;
    delete fields.longitude;
    const restaurantFields = fields as Omit<
      UpdateOwnedRestaurantDto,
      | 'address'
      | 'addressStreet'
      | 'addressWard'
      | 'addressDistrict'
      | 'addressCity'
      | 'latitude'
      | 'longitude'
    >;
    return {
      ...restaurantFields,
      ...(latitude !== undefined ? { latitude: this.toCoordinate(latitude, 'latitude') } : {}),
      ...(longitude !== undefined ? { longitude: this.toCoordinate(longitude, 'longitude') } : {}),
    };
  }

  private hasAddressChange(update: UpdateOwnedRestaurantDto): boolean {
    return [
      update.address,
      update.addressStreet,
      update.addressWard,
      update.addressDistrict,
      update.addressCity,
    ].some((value) => value !== undefined);
  }

  private toCreateRestaurantFields(request: RequestRestaurantDto): Partial<Restaurant> {
    const fields = { ...request };
    delete fields.address;
    delete fields.addressStreet;
    delete fields.addressWard;
    delete fields.addressDistrict;
    delete fields.addressCity;
    delete fields.latitude;
    delete fields.longitude;
    return fields as Omit<
      RequestRestaurantDto,
      | 'address'
      | 'addressStreet'
      | 'addressWard'
      | 'addressDistrict'
      | 'addressCity'
      | 'latitude'
      | 'longitude'
    > as Partial<Restaurant>;
  }

  private toCoordinate(value: string | undefined, label: string): number | undefined {
    if (value === undefined) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(`${label} must be a number`);
    }
    return parsed;
  }

  private async uploadOptional(
    file: Express.Multer.File | undefined,
    path: string,
    uploadedUrls: string[],
  ): Promise<string | undefined> {
    if (!file) return undefined;
    const upload = await this.storagePort.upload(file, file.originalname, path);
    uploadedUrls.push(upload.url);
    return upload.url;
  }

  private async deleteIfReplaced(previousUrl: string | null, nextUrl: string): Promise<void> {
    if (previousUrl && previousUrl !== nextUrl) {
      await this.storagePort
        .deleteFile(previousUrl)
        .catch((error) =>
          this.logger.warn(
            `Could not remove replaced restaurant file: ${(error as Error).message}`,
          ),
        );
    }
  }

  private withDistance(restaurant: Restaurant, lat?: number, lng?: number): RestaurantWithDistance {
    const restaurantLat = restaurant.latitude ?? restaurant.address?.latitude;
    const restaurantLng = restaurant.longitude ?? restaurant.address?.longitude;
    const distance =
      lat !== undefined && lng !== undefined && restaurantLat != null && restaurantLng != null
        ? haversineDistance(lat, lng, Number(restaurantLat), Number(restaurantLng))
        : null;
    return {
      ...restaurant,
      distance,
      deliveryTime: distance === null ? null : estimateDeliveryTime(distance),
    };
  }

  private async clearRestaurantCache(restaurantId?: string, ownerId?: string): Promise<void> {
    await Promise.all([
      this.cache.deleteByPattern('restaurant:*'),
      restaurantId
        ? this.cache.deleteByPattern(`restaurant:${restaurantId}:*`)
        : Promise.resolve(0),
      ownerId ? this.cache.deleteByPattern(`restaurant:owner:${ownerId}:*`) : Promise.resolve(0),
    ]);
  }

  private cacheKey(namespace: string, values: Record<string, unknown>): string {
    const parts = Object.entries(values)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `${namespace}:${JSON.stringify(parts)}`;
  }

  private toPage(
    items: RestaurantWithDistance[],
    totalItems: number,
    page: number,
    pageSize: number,
  ) {
    return { items, totalItems, page, pageSize, totalPages: Math.ceil(totalItems / pageSize) };
  }
}
