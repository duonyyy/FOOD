import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ShipperProfile } from 'src/entities/shipperProfile.entity';
import { IdentityUserProfileService } from 'src/features/users/identity-user-profile.public-api';
import { pubSub } from 'src/pubsub';
import { FindOptionsWhere, Repository } from 'typeorm';
import { UpdateDriverProfileDto } from '../../dto/update-driver-dto';
import {
  SHIPPER_PROFILE_STATUS,
  type CreateShipperProfileCommand,
  type ShipperProfileStatus,
  type ShipperProfileView,
} from '../../types/shipper-profile.types';

/**
 * ShipperProfileService manages shipper profiles, verification certificates,
 * and GPS coordinate broadcasts.
 */
@Injectable()
export class ShipperProfileService {
  constructor(
    @InjectRepository(ShipperProfile)
    private readonly profileRepository: Repository<ShipperProfile>,
    private readonly identityUserProfile: IdentityUserProfileService,
  ) {}

  async findByUserId(userId: string): Promise<ShipperProfileView | null> {
    const profile = await this.profileRepository.findOne({ where: { userId } });
    return profile ? this.toProfileView(profile) : null;
  }

  async findByStatus(
    status?: ShipperProfileStatus,
    userId?: string,
  ): Promise<ShipperProfileView[]> {
    const where: FindOptionsWhere<ShipperProfile> = {};
    if (status) {
      where.certificateStatus = status;
    }
    if (userId) {
      where.userId = userId;
    }

    const profiles = await this.profileRepository.find({ where });
    return profiles.map((profile) => this.toProfileView(profile));
  }

  async createPending(command: CreateShipperProfileCommand): Promise<ShipperProfileView> {
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

    return this.toProfileView(await this.profileRepository.save(profile));
  }

  async updateCertificateStatus(
    userId: string,
    status: ShipperProfileStatus,
  ): Promise<ShipperProfileView> {
    const profile = await this.profileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Shipper profile not found');
    }

    profile.certificateStatus = status;
    profile.certificateVerifiedAt = status === SHIPPER_PROFILE_STATUS.APPROVED ? new Date() : null;
    return this.toProfileView(await this.profileRepository.save(profile));
  }

  async updateDriverProfile(userId: string, dto: UpdateDriverProfileDto) {
    if (dto.name !== undefined || dto.phone !== undefined || dto.birthday !== undefined) {
      await this.identityUserProfile.updateProfile(userId, {
        name: dto.name,
        phone: dto.phone,
        birthday: dto.birthday ? new Date(dto.birthday) : undefined,
      });
    }

    const profile = await this.profileRepository.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Không tìm thấy tài xế');

    if (dto.cccd) profile.cccd = dto.cccd;
    if (dto.driverLicense) profile.driverLicense = dto.driverLicense;
    await this.profileRepository.save(profile);

    return { message: 'Cập nhật hồ sơ thành công' };
  }

  async getDriverProfile(userId: string) {
    const identity = await this.identityUserProfile.findProfile(userId);
    const name = identity?.name ?? '';
    const phone = identity?.phone ?? '';
    const birthday = identity?.birthday?.toISOString().split('T')[0];
    let cccd = '';
    let driverLicense = '';

    const profile = await this.profileRepository.findOne({ where: { userId } });
    if (profile) {
      if (!cccd && profile.cccd) cccd = profile.cccd;
      if (!driverLicense && profile.driverLicense) driverLicense = profile.driverLicense;
    }

    if (!identity && !profile) {
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
    const profile = await this.profileRepository.findOne({ where: { userId: shipperId } });
    if (!profile) throw new NotFoundException('Shipper not found');

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

  private toProfileView(profile: ShipperProfile): ShipperProfileView {
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
