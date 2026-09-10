import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ShipperProfile } from '../../../entities/shipperProfile.entity';
import {
  CreateShipperProfileCommand,
  SHIPPER_PROFILE_STATUS,
  ShipperProfileCommandPort,
  ShipperProfileReaderPort,
  ShipperProfileSnapshot,
  ShipperProfileStatus,
} from '../contracts/shipper-profile.port';

@Injectable()
export class ShipperProfileService implements ShipperProfileReaderPort, ShipperProfileCommandPort {
  constructor(
    @InjectRepository(ShipperProfile)
    private readonly profileRepository: Repository<ShipperProfile>,
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
