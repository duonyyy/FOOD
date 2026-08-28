import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShipperProfile } from '../../../entities/shipperProfile.entity';
import {
  ShipperProfileReaderPort,
  ShipperProfileSnapshot,
} from '../contracts/shipper-profile.port';

@Injectable()
export class ShipperProfileService implements ShipperProfileReaderPort {
  constructor(
    @InjectRepository(ShipperProfile)
    private readonly profileRepository: Repository<ShipperProfile>,
  ) {}

  async findByUserId(userId: string): Promise<ShipperProfileSnapshot | null> {
    const profile = await this.profileRepository.findOne({ where: { userId } });
    return profile ? this.toSnapshot(profile) : null;
  }

  private toSnapshot(profile: ShipperProfile): ShipperProfileSnapshot {
    return {
      userId: profile.userId,
      certificateStatus: profile.certificateStatus,
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
}
