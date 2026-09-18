import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PendingShipperAssignment } from 'src/entities/pendingShipperAssignment.entity';
import {
  CertificateStatus,
  ShipperCertificateInfo,
} from 'src/entities/shipperCertificateInfo.entity';
import { ShippingDetail, ShippingStatus } from 'src/entities/shippingDetail.entity';
import {
  IdentityUserQueryService,
  type UserIdentity,
} from 'src/features/users/public-api';
import { Repository } from 'typeorm';
import { ShipperProfileService } from '../shipper/shipper-profile.service';
import {
  SHIPPER_PROFILE_STATUS,
  type ShipperProfileStatus,
} from '../../types/shipper-profile.types';

/**
 * AdminDeliveryService handles administrative operations for delivery management:
 * driver approval/rejection, platform-wide shipper inquiries, and assignment overviews.
 */
@Injectable()
export class AdminDeliveryService {
  private readonly logger = new Logger(AdminDeliveryService.name);

  constructor(
    @InjectRepository(ShipperCertificateInfo)
    private readonly certRepo: Repository<ShipperCertificateInfo>,
    @InjectRepository(ShippingDetail)
    private readonly shippingDetailRepository: Repository<ShippingDetail>,
    @InjectRepository(PendingShipperAssignment)
    private readonly pendingAssignmentRepository: Repository<PendingShipperAssignment>,
    private readonly shipperProfileService: ShipperProfileService,
    private readonly identityReader: IdentityUserQueryService,
  ) {}

  async getShippers(status?: ShipperProfileStatus) {
    const profiles = await this.shipperProfileService.findByStatus(status);
    const users = await this.identityReader.findIdentityUsers(
      profiles.map((profile) => profile.userId),
    );
    const usersById = new Map(users.map((user) => [user.userId, user]));

    return profiles.flatMap((profile) => {
      const user = usersById.get(profile.userId);
      return user ? [this.toShipperListItem(profile, user)] : [];
    });
  }

  async getShipperDetail(shipperId: string) {
    const [profile, shipper] = await Promise.all([
      this.shipperProfileService.findByUserId(shipperId),
      this.identityReader.findIdentityUser(shipperId),
    ]);
    if (!profile || !shipper || shipper.roleName !== 'shipper') {
      throw new NotFoundException(`Shipper with ID ${shipperId} not found`);
    }

    const completedDeliveriesCount = await this.shippingDetailRepository.count({
      where: {
        shipper: { id: shipperId },
        status: ShippingStatus.COMPLETED,
      },
    });

    return {
      shipper: this.toIdentityProjection(shipper),
      profile,
      metrics: {
        totalCompletedDeliveries: completedDeliveriesCount,
        activeDeliveries: profile.activeDeliveries,
        totalEarnings: profile.totalEarnings,
        averageRating: profile.averageRating,
      },
    };
  }

  async approveShipper(userId: string) {
    const cert = await this.certRepo.findOne({ where: { user: { id: userId } } });
    if (cert) {
      cert.status = CertificateStatus.APPROVED;
      cert.verifiedAt = new Date();
      await this.certRepo.save(cert);
    }

    try {
      await this.shipperProfileService.updateCertificateStatus(
        userId,
        SHIPPER_PROFILE_STATUS.APPROVED,
      );
    } catch {
      this.logger.debug(`Shipper profile for ${userId} not present in ddd table, skipping sync`);
    }

    this.logger.log(`Shipper ${userId} approved by admin`);
    return { success: true, message: 'Tài xế đã được phê duyệt thành công' };
  }

  async rejectShipper(userId: string, reason?: string) {
    const cert = await this.certRepo.findOne({ where: { user: { id: userId } } });
    if (cert) {
      cert.status = CertificateStatus.REJECTED;
      await this.certRepo.save(cert);
    }

    try {
      await this.shipperProfileService.updateCertificateStatus(
        userId,
        SHIPPER_PROFILE_STATUS.REJECTED,
      );
    } catch {
      this.logger.debug(`Shipper profile for ${userId} not present in ddd table, skipping sync`);
    }

    this.logger.log(`Shipper ${userId} rejected by admin. Reason: ${reason ?? 'N/A'}`);
    return { success: true, message: 'Đã từ chối tài xế', reason };
  }

  async getDeliveryAssignmentsOverview() {
    return this.pendingAssignmentRepository.find({
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  private toShipperListItem(
    profile: Awaited<ReturnType<ShipperProfileService['findByStatus']>>[number],
    user: UserIdentity,
  ) {
    return {
      id: profile.userId,
      status: profile.certificateStatus,
      verifiedAt: profile.certificateVerifiedAt,
      user: this.toIdentityProjection(user),
    };
  }

  private toIdentityProjection(user: UserIdentity) {
    return {
      id: user.userId,
      username: user.username,
      name: user.name,
      roleName: user.roleName,
      isActive: user.isActive,
    };
  }
}
