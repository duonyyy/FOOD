import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Address } from 'src/entities/address.entity';
import { LessThan, Repository } from 'typeorm';
import {
  type CreateAddressPayload,
  type DeliveryAddress,
  type TemporaryDeliveryAddress,
} from '../types/location.types';
import { AddressResponseDto } from './dto/address-response.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

type AddressWriteData = Pick<
  Address,
  | 'street'
  | 'ward'
  | 'district'
  | 'city'
  | 'latitude'
  | 'longitude'
  | 'isDefault'
  | 'label'
  | 'isTemporary'
>;

@Injectable()
export class AddressService {
  private readonly logger = new Logger(AddressService.name);

  constructor(
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
  ) {}

  async createAddress(data: CreateAddressDto): Promise<AddressResponseDto> {
    const address = this.addressRepository.create(this.toPersistence(data));
    return this.toAddressResponse(await this.addressRepository.save(address));
  }

  // --- Cross-feature write methods ---

  async writeAddress(
    data: CreateAddressPayload,
    ownerUserId?: string,
  ): Promise<{ addressId: string }> {
    const address = this.addressRepository.create({
      ...this.toPersistence(data),
      ...(ownerUserId ? { user: { id: ownerUserId } } : {}),
    });
    const saved = await this.addressRepository.save(address);
    return { addressId: saved.id };
  }

  async replaceOwnedAddresses(
    ownerUserId: string,
    addresses: Partial<CreateAddressPayload>[],
  ): Promise<void> {
    await this.addressRepository.delete({ user: { id: ownerUserId } });
    if (addresses.length === 0) {
      return;
    }

    await this.addressRepository.save(
      addresses.map((address) =>
        this.addressRepository.create({
          ...this.toPersistence(address),
          user: { id: ownerUserId },
        }),
      ),
    );
  }

  async modifyAddress(id: string, data: Partial<CreateAddressPayload>): Promise<void> {
    await this.addressRepository.update(id, this.toPersistence(data));
  }

  async removeAddress(id: string): Promise<void> {
    await this.deleteAddress(id);
  }

  async removeExpiredTemporaryAddresses(before: Date): Promise<number> {
    const result = await this.addressRepository.delete({
      isTemporary: true,
      createdAt: LessThan(before),
    });
    return result.affected ?? 0;
  }

  /** Creates an address used only while a customer is placing an order. */
  async createTemporaryAddress(
    data: Omit<CreateAddressPayload, 'isTemporary'>,
    ownerUserId: string,
  ): Promise<{ addressId: string }> {
    const latitude = Number(data.latitude);
    const longitude = Number(data.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestException('Temporary address coordinates are required');
    }
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      throw new BadRequestException(`Invalid coordinates: lat=${latitude}, lng=${longitude}`);
    }

    return this.writeAddress(
      {
        ...data,
        latitude,
        longitude,
        label: data.label || 'Địa chỉ tùy chỉnh',
        isTemporary: true,
      },
      ownerUserId,
    );
  }

  /** Removes a temporary address when order creation does not complete. */
  async removeTemporaryAddress(addressId: string): Promise<void> {
    const address = await this.findTemporaryAddress(addressId);
    if (address) {
      await this.removeAddress(addressId);
    }
  }

  /** Address cleanup belongs to Locations, which owns the Address lifecycle. */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredTemporaryAddresses(): Promise<void> {
    const before = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
      const removedCount = await this.removeExpiredTemporaryAddresses(before);
      if (removedCount > 0) {
        this.logger.log(`Removed ${removedCount} temporary addresses older than 24 hours`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to clean up temporary addresses: ${message}`);
    }
  }

  // --- Original Controller Methods ---

  async createAddressForUser(data: CreateAddressDto, userId: string): Promise<AddressResponseDto> {
    const address = this.addressRepository.create({
      ...this.toPersistence(data),
      user: { id: userId },
    });
    return this.toAddressResponse(await this.addressRepository.save(address));
  }

  async getAllAddresses(): Promise<AddressResponseDto[]> {
    const addresses = await this.addressRepository.find({ relations: ['user'] });
    return addresses.map((address) => this.toAddressResponse(address));
  }

  async getAddressById(id: string): Promise<AddressResponseDto> {
    const address = await this.loadAddress(id);
    return this.toAddressResponse(address);
  }

  async getOwnedAddressById(id: string, userId: string): Promise<AddressResponseDto> {
    const address = await this.loadAddress(id);
    this.assertOwnership(address, userId);
    return this.toAddressResponse(address);
  }

  async getAddressesByUser(userId: string): Promise<AddressResponseDto[]> {
    const addresses = await this.addressRepository.find({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    return addresses.map((address) => this.toAddressResponse(address));
  }

  async getAddresseByUser(userId: string): Promise<AddressResponseDto[]> {
    return this.getAddressesByUser(userId);
  }

  async updateAddress(id: string, data: UpdateAddressDto): Promise<AddressResponseDto> {
    await this.updateEntity(id, data);
    return this.getAddressById(id);
  }

  async updateOwnedAddress(
    id: string,
    data: UpdateAddressDto,
    userId: string,
  ): Promise<AddressResponseDto> {
    const address = await this.loadAddress(id);
    this.assertOwnership(address, userId);
    await this.addressRepository.update(id, this.toPersistence(data));
    return this.getOwnedAddressById(id, userId);
  }

  async deleteAddress(id: string): Promise<{ message: string }> {
    const result = await this.addressRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Address not found');
    }
    return { message: 'Address deleted successfully' };
  }

  async deleteOwnedAddress(id: string, userId: string): Promise<{ message: string }> {
    const address = await this.loadAddress(id);
    this.assertOwnership(address, userId);
    return this.deleteAddress(id);
  }

  async findAddress(addressId: string): Promise<DeliveryAddress | null> {
    const address = await this.addressRepository.findOne({ where: { id: addressId } });
    return address ? this.toDeliveryAddress(address) : null;
  }

  async findOwnedAddress(addressId: string, ownerUserId: string): Promise<DeliveryAddress | null> {
    const address = await this.addressRepository.findOne({
      where: { id: addressId, user: { id: ownerUserId } },
    });
    return address ? this.toDeliveryAddress(address) : null;
  }

  async findTemporaryAddress(addressId: string): Promise<TemporaryDeliveryAddress | null> {
    const address = await this.findAddress(addressId);
    return address?.isTemporary ? { ...address, isTemporary: true } : null;
  }

  async listOwnedAddresses(ownerUserId: string): Promise<DeliveryAddress[]> {
    const addresses = await this.addressRepository.find({
      where: { user: { id: ownerUserId } },
    });
    return addresses.map((address) => this.toDeliveryAddress(address));
  }

  private async loadAddress(id: string): Promise<Address> {
    const address = await this.addressRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    return address;
  }

  private assertOwnership(address: Address, userId: string): void {
    if (address.user?.id !== userId) {
      throw new ForbiddenException("You cannot access another user's address");
    }
  }

  private async updateEntity(id: string, data: UpdateAddressDto): Promise<void> {
    const address = await this.loadAddress(id);
    Object.assign(address, this.toPersistence(data));
    await this.addressRepository.save(address);
  }

  private toPersistence(
    data:
      | CreateAddressDto
      | UpdateAddressDto
      | CreateAddressPayload
      | Partial<CreateAddressPayload>,
  ): Partial<AddressWriteData> {
    const input = data as Partial<AddressWriteData>;
    return {
      street: input.street,
      ward: input.ward,
      district: input.district,
      city: input.city,
      latitude: input.latitude,
      longitude: input.longitude,
      isDefault: input.isDefault,
      label: input.label,
      isTemporary: input.isTemporary,
    };
  }

  private toDeliveryAddress(address: Address): DeliveryAddress {
    return {
      addressId: address.id,
      street: address.street,
      ward: address.ward,
      district: address.district,
      city: address.city,
      latitude: address.latitude ?? null,
      longitude: address.longitude ?? null,
      isTemporary: Boolean(address.isTemporary),
    };
  }

  private toAddressResponse(address: Address): AddressResponseDto {
    return {
      id: address.id,
      street: address.street,
      ward: address.ward ?? null,
      district: address.district ?? null,
      city: address.city,
      latitude: address.latitude ?? null,
      longitude: address.longitude ?? null,
      isDefault: Boolean(address.isDefault),
      label: address.label ?? null,
      isTemporary: Boolean(address.isTemporary),
      createdAt: address.createdAt ?? null,
    };
  }
}
