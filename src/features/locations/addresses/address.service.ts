import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Address } from 'src/entities/address.entity';
import { Repository } from 'typeorm';
import {
  type AddressSnapshot,
  type LocationReaderPort,
  type TemporaryAddressSnapshot,
} from '../contracts/location-reader.port';
import { type LocationWriterPort, type CreateAddressPayload } from '../contracts/location-writer.port';
import { toAddressResponse } from './address.mapper';
import { AddressResponseDto } from './dto/address-response.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressService implements LocationReaderPort, LocationWriterPort {
  constructor(
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
  ) {}

  async createAddress(data: CreateAddressDto): Promise<AddressResponseDto> {
    const address = this.addressRepository.create(this.toPersistence(data));
    return toAddressResponse(await this.addressRepository.save(address));
  }

  // --- LocationWriterPort Implementation ---

  async writeAddress(
    data: CreateAddressPayload,
    ownerUserId?: string,
  ): Promise<{ addressId: string }> {
    const address = this.addressRepository.create({
      ...this.toPersistence(data as any),
      ...(ownerUserId ? { user: { id: ownerUserId } } : {}),
    });
    const saved = await this.addressRepository.save(address);
    return { addressId: saved.id };
  }

  async modifyAddress(id: string, data: Partial<CreateAddressPayload>): Promise<void> {
    await this.addressRepository.update(id, this.toPersistence(data as any));
  }

  async removeAddress(id: string): Promise<void> {
    await this.deleteAddress(id);
  }

  // --- Original Controller Methods ---

  async createAddressForUser(data: CreateAddressDto, userId: string): Promise<AddressResponseDto> {
    const address = this.addressRepository.create({
      ...this.toPersistence(data),
      user: { id: userId },
    });
    return toAddressResponse(await this.addressRepository.save(address));
  }

  async getAllAddresses(): Promise<AddressResponseDto[]> {
    const addresses = await this.addressRepository.find({ relations: ['user'] });
    return addresses.map(toAddressResponse);
  }

  async getAddressById(id: string): Promise<AddressResponseDto> {
    const address = await this.loadAddress(id);
    return toAddressResponse(address);
  }

  async getOwnedAddressById(id: string, userId: string): Promise<AddressResponseDto> {
    const address = await this.loadAddress(id);
    this.assertOwnership(address, userId);
    return toAddressResponse(address);
  }

  async getAddressesByUser(userId: string): Promise<AddressResponseDto[]> {
    const addresses = await this.addressRepository.find({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    return addresses.map(toAddressResponse);
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

  async findAddress(addressId: string): Promise<AddressSnapshot | null> {
    const address = await this.addressRepository.findOne({ where: { id: addressId } });
    return address ? this.toSnapshot(address) : null;
  }

  async findTemporaryAddress(addressId: string): Promise<TemporaryAddressSnapshot | null> {
    const snapshot = await this.findAddress(addressId);
    return snapshot?.isTemporary ? { ...snapshot, isTemporary: true } : null;
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

  private toPersistence(data: CreateAddressDto | UpdateAddressDto): Partial<Address> {
    const addressData = { ...data } as Record<string, unknown>;
    delete addressData.id;
    delete addressData.userId;
    return addressData as Partial<Address>;
  }

  private toSnapshot(address: Address): AddressSnapshot {
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
}
