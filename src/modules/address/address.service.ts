import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Address } from 'src/entities/address.entity';
import { Repository } from 'typeorm';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressService {
  constructor(
    @InjectRepository(Address)
    private addressRepository: Repository<Address>,
  ) {}

  async createAddress(data: CreateAddressDto) {
    const address = this.addressRepository.create(data);
    return await this.addressRepository.save(address);
  }

  async createAddressForUser(data: CreateAddressDto, userId: string) {
    const addressData: Partial<CreateAddressDto> = { ...data };
    delete addressData.id;
    delete addressData.userId;
    const address = this.addressRepository.create({
      ...addressData,
      user: { id: userId },
    });
    return this.addressRepository.save(address);
  }

  async getAllAddresses() {
    return await this.addressRepository.find({ relations: ['user'] });
  }

  async getAddressById(id: string) {
    const address = await this.addressRepository.findOne({ where: { id }, relations: ['user'] });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  async getOwnedAddressById(id: string, userId: string) {
    const address = await this.getAddressById(id);
    if (address.user?.id !== userId) {
      throw new ForbiddenException("You cannot access another user's address");
    }
    return address;
  }

  async getAddressesByUser(userId: string) {
    return await this.addressRepository
      .createQueryBuilder('address')
      .innerJoin('address.users', 'user')
      .where('user.id = :userId', { userId })
      .getMany();
  }

  async getAddresseByUser(userId: string) {
    return await this.addressRepository.find({
      where: { user: { id: userId } },
      relations: ['user'], // Đảm bảo truy vấn liên quan tới user
    });
  }

  async updateAddress(id: string, data: UpdateAddressDto) {
    await this.addressRepository.update(id, data);
    return this.getAddressById(id);
  }

  async updateOwnedAddress(id: string, data: UpdateAddressDto, userId: string) {
    await this.getOwnedAddressById(id, userId);
    const addressData: Partial<UpdateAddressDto> = { ...data };
    delete addressData.id;
    delete addressData.userId;
    await this.addressRepository.update(id, addressData);
    return this.getOwnedAddressById(id, userId);
  }

  async deleteAddress(id: string) {
    const result = await this.addressRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Address not found');
    return { message: 'Address deleted successfully' };
  }

  async deleteOwnedAddress(id: string, userId: string) {
    await this.getOwnedAddressById(id, userId);
    return this.deleteAddress(id);
  }
}
