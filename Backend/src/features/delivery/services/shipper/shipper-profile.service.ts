import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ShipperCertificateInfo } from 'src/entities/shipperCertificateInfo.entity';
import { ShipperProfile } from 'src/entities/shipperProfile.entity';
import { User } from 'src/entities/user.entity';
import { pubSub } from 'src/pubsub';
import { FindOptionsWhere, Repository } from 'typeorm';
import {
  CreateShipperProfileCommand,
  SHIPPER_PROFILE_STATUS,
  ShipperProfileCommandPort,
  ShipperProfileReaderPort,
  ShipperProfileSnapshot,
  ShipperProfileStatus,
} from '../../contracts/shipper-profile.port';
import { UpdateDriverProfileDto } from '../../dto/update-driver-dto';

/**
 * ShipperProfileService manages shipper profiles, verification certificates,
 * and GPS coordinate broadcasts.
 */
@Injectable()
export class ShipperProfileService implements ShipperProfileReaderPort, ShipperProfileCommandPort {
  constructor(
    @InjectRepository(ShipperProfile)
    private readonly profileRepository: Repository<ShipperProfile>,
    @Optional()
    @InjectRepository(User)
    private readonly userRepository?: Repository<User>,
    @Optional()
    @InjectRepository(ShipperCertificateInfo)
    private readonly certRepo?: Repository<ShipperCertificateInfo>,
  ) {}

  async findByUserId(userId: string): Promise<ShipperProfileSnapshot | null> {
    const profile = await this.profileRepository.findOne({ where: { userId } });
    return profile ? this.toSnapshot(profile) : null;
  }

  async findByStatus(
    status?: ShipperProfileStatus,
    userId?: string,
  ): Promise<ShipperProfileSnapshot[]> {
    const where: FindOptionsWhere<ShipperProfile> = {};
    if (status) {
      where.certificateStatus = status;
    }
    if (userId) {
      where.userId = userId;
    }

    const profiles = await this.profileRepository.find({ where });
    return profiles.map((profile) => this.toSnapshot(profile));
  }

  async createPending(command: CreateShipperProfileCommand): Promise<ShipperProfileSnapshot> {
    const existing = await this.profileRepository.findOne({
      where: { userId: command.userId },
    });
    const profile = existing ?? this.profileRepository.create({ userId: command.userId });

    if (command.cccd !== undefined) {
      profile.cccd = command.cccd;
    }
    if (command.driverLicense !== undefined) {
      profile.driverLicense = command.driverLicense;
    }
    if (!existing) {
      profile.certificateStatus = SHIPPER_PROFILE_STATUS.PENDING;
    }

    return this.toSnapshot(await this.profileRepository.save(profile));
  }

  async updateCertificateStatus(
    userId: string,
    status: ShipperProfileStatus,
  ): Promise<ShipperProfileSnapshot> {
    const profile = await this.profileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Shipper profile not found');
    }

    profile.certificateStatus = status;
    profile.certificateVerifiedAt = status === SHIPPER_PROFILE_STATUS.APPROVED ? new Date() : null;
    return this.toSnapshot(await this.profileRepository.save(profile));
  }

  async updateDriverProfile(userId: string, dto: UpdateDriverProfileDto) {
    if (this.userRepository) {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['shipperCertificateInfo'],
      });
      if (!user) throw new NotFoundException('Người dùng không tồn tại');

      if (dto.name) user.name = dto.name;
      if (dto.phone) user.phone = dto.phone;
      if (dto.birthday) user.birthday = new Date(dto.birthday);

      await this.userRepository.save(user);

      const cert = user.shipperCertificateInfo;
      if (cert && this.certRepo) {
        if (dto.cccd) cert.cccd = dto.cccd;
        if (dto.driverLicense) cert.driverLicense = dto.driverLicense;
        await this.certRepo.save(cert);
      }
    }

    const profile = await this.profileRepository.findOne({ where: { userId } });
    if (profile) {
      if (dto.cccd) profile.cccd = dto.cccd;
      if (dto.driverLicense) profile.driverLicense = dto.driverLicense;
      await this.profileRepository.save(profile);
    }

    return { message: 'Cập nhật hồ sơ thành công' };
  }

  async getDriverProfile(userId: string) {
    let name = '';
    let phone = '';
    let birthday: string | undefined;
    let cccd = '';
    let driverLicense = '';

    if (this.userRepository) {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['shipperCertificateInfo'],
      });
      if (user) {
        name = user.name || '';
        phone = user.phone || '';
        birthday = user.birthday?.toISOString().split('T')[0];
        cccd = user.shipperCertificateInfo?.cccd || '';
        driverLicense = user.shipperCertificateInfo?.driverLicense || '';
      }
    }

    const profile = await this.profileRepository.findOne({ where: { userId } });
    if (profile) {
      if (!cccd && profile.cccd) cccd = profile.cccd;
      if (!driverLicense && profile.driverLicense) driverLicense = profile.driverLicense;
    }

    if (!name && !profile) {
      throw new NotFoundException('Không tìm thấy tài xế');
    }

    return {
      name,
      phone,
      birthday,
      cccd,
      driverLicense,
    };
  }

  async updateLocation(shipperId: string, latitude: number, longitude: number) {
    if (this.userRepository) {
      const shipper = await this.userRepository.findOne({
        where: { id: shipperId },
        relations: ['shipperCertificateInfo'],
      });

      if (!shipper) {
        throw new NotFoundException('Shipper not found');
      }
    }

    await pubSub.publish('shipperLocationUpdated', {
      shipperLocationUpdated: {
        shipperId,
        latitude,
        longitude,
        updatedAt: new Date(),
      },
    });

    return { message: 'Location updated successfully', success: true };
  }

  private toSnapshot(profile: ShipperProfile): ShipperProfileSnapshot {
    return {
      userId: profile.userId,
      cccd: profile.cccd,
      driverLicense: profile.driverLicense,
      certificateStatus: this.toStatus(profile.certificateStatus),
      certificateVerifiedAt: profile.certificateVerifiedAt,
      isAvailable: profile.isAvailable,
      maxActiveDeliveries: profile.maxActiveDeliveries,
      serviceRadiusKm: profile.serviceRadiusKm,
      completedDeliveries: profile.completedDeliveries,
      failedDeliveries: profile.failedDeliveries,
      activeDeliveries: profile.activeDeliveries,
      averageRating: profile.averageRating,
      totalEarnings: profile.totalEarnings,
    };
  }

  private toStatus(status: string): ShipperProfileStatus {
    const validStatuses = Object.values(SHIPPER_PROFILE_STATUS) as readonly string[];
    if (!validStatuses.includes(status)) {
      throw new Error(`Unsupported shipper profile status: ${status}`);
    }
    return status as ShipperProfileStatus;
  }
}
