import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { haversineDistance } from 'src/common/utils/geo.util';
import { SystemConstraintsService } from 'src/features/system-constraints/public-api';
import {
  SHIPPER_PROFILE_STATUS,
  type ShipperProfileSnapshot,
} from '../../contracts/shipper-profile.port';
import { ShipperProfileService } from '../shipper/shipper-profile.service';

export interface ActiveShipperSnapshot {
  shipperId: string;
  latitude: number;
  longitude: number;
  maxDistance: number;
  lastSeen: Date;
  eligibilityScore: number;
  profile: ShipperProfileSnapshot;
}

/**
 * Delivery-owned in-memory presence and ranking projection. It intentionally
 * uses ShipperProfile rather than the Identity User entity, so driver runtime
 * state cannot leak back into the Users feature.
 */
@Injectable()
export class ActiveShipperTrackerService implements OnModuleDestroy {
  private readonly activeShippers = new Map<string, ActiveShipperSnapshot>();
  private readonly cleanupInterval = setInterval(() => void this.cleanup(), 5 * 60 * 1000);

  constructor(
    private readonly shipperProfileService: ShipperProfileService,
    private readonly systemConstraintsService: SystemConstraintsService,
  ) {}

  async addShipper(
    shipperId: string,
    latitude: number,
    longitude: number,
    requestedMaxDistance: number,
  ): Promise<{ success: boolean; message: string; score?: number }> {
    if (
      !shipperId ||
      !this.isCoordinate(latitude, longitude) ||
      !Number.isFinite(requestedMaxDistance)
    ) {
      return { success: false, message: 'Invalid shipper location or distance' };
    }

    const profile = await this.shipperProfileService.findByUserId(shipperId);
    if (!profile) {
      return { success: false, message: 'Shipper profile not found' };
    }

    const eligibility = await this.getEligibility(profile);
    if (!eligibility.eligible) {
      return { success: false, message: eligibility.reason, score: eligibility.score };
    }

    const maxDistance = Math.min(Math.max(0, requestedMaxDistance), profile.serviceRadiusKm);
    if (maxDistance <= 0) {
      return { success: false, message: 'Shipper service radius is not available' };
    }

    this.activeShippers.set(shipperId, {
      shipperId,
      latitude,
      longitude,
      maxDistance,
      lastSeen: new Date(),
      eligibilityScore: eligibility.score,
      profile,
    });
    return {
      success: true,
      message: 'Successfully added to shipper pool',
      score: eligibility.score,
    };
  }

  async findBestShipperForOrder(
    restaurantLatitude: number,
    restaurantLongitude: number,
    orderValue = 0,
    urgency: 'low' | 'medium' | 'high' = 'medium',
  ): Promise<{ shipperId: string; score: number; distance: number } | null> {
    if (!this.isCoordinate(restaurantLatitude, restaurantLongitude)) {
      return null;
    }

    const constraints = await this.systemConstraintsService.getConstraints();
    const urgencyBonus = { low: 0, medium: 8, high: 15 }[urgency];
    const valueBonus = Math.min(10, (Math.max(0, orderValue) / 100_000) * 5);
    let best: { shipperId: string; score: number; distance: number } | null = null;

    for (const shipper of this.activeShippers.values()) {
      const distance = haversineDistance(
        shipper.latitude,
        shipper.longitude,
        restaurantLatitude,
        restaurantLongitude,
      );
      if (distance > shipper.maxDistance || distance > constraints.max_delivery_distance) {
        continue;
      }

      const eligibility = await this.getEligibility(shipper.profile);
      if (!eligibility.eligible) {
        this.activeShippers.delete(shipper.shipperId);
        continue;
      }

      const score = Math.max(
        0,
        eligibility.score -
          (distance / constraints.max_delivery_distance) * 25 +
          urgencyBonus +
          valueBonus,
      );
      if (!best || score > best.score) {
        best = { shipperId: shipper.shipperId, score: Math.round(score * 100) / 100, distance };
      }
    }
    return best;
  }

  getAllShippers(): ActiveShipperSnapshot[] {
    return [...this.activeShippers.values()];
  }

  getShipperStats() {
    const shippers = this.getAllShippers().sort(
      (left, right) => right.eligibilityScore - left.eligibilityScore,
    );
    const averageScore = shippers.length
      ? shippers.reduce((total, shipper) => total + shipper.eligibilityScore, 0) / shippers.length
      : 0;
    return {
      activeShippers: shippers.length,
      averageScore: Math.round(averageScore * 100) / 100,
      topShippers: shippers.slice(0, 5).map((shipper) => ({
        id: shipper.shipperId,
        score: shipper.eligibilityScore,
        activeDeliveries: shipper.profile.activeDeliveries,
        completedDeliveries: shipper.profile.completedDeliveries,
        rating: shipper.profile.averageRating,
      })),
    };
  }

  cleanup(): void {
    const inactiveBefore = new Date(Date.now() - 5 * 60 * 1000);
    for (const [shipperId, shipper] of this.activeShippers.entries()) {
      if (shipper.lastSeen < inactiveBefore) {
        this.activeShippers.delete(shipperId);
      }
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupInterval);
  }

  private async getEligibility(profile: ShipperProfileSnapshot): Promise<{
    eligible: boolean;
    reason: string;
    score: number;
  }> {
    const constraints = await this.systemConstraintsService.getConstraints();
    if (profile.certificateStatus !== SHIPPER_PROFILE_STATUS.APPROVED) {
      return { eligible: false, reason: 'Shipper certificate is not approved', score: 0 };
    }
    if (!profile.isAvailable) {
      return { eligible: false, reason: 'Shipper is unavailable', score: 0 };
    }
    const activeLimit = Math.min(profile.maxActiveDeliveries, constraints.max_active_deliveries);
    if (profile.activeDeliveries >= activeLimit) {
      return { eligible: false, reason: 'Shipper reached active delivery limit', score: 0 };
    }
    if (profile.averageRating < constraints.min_shipper_rating) {
      return { eligible: false, reason: 'Shipper rating is below the minimum', score: 0 };
    }
    const totalDeliveries = profile.completedDeliveries + profile.failedDeliveries;
    const completionRate =
      totalDeliveries === 0 ? 1 : profile.completedDeliveries / totalDeliveries;
    if (
      totalDeliveries >= constraints.min_total_orders &&
      completionRate < constraints.min_completion_rate
    ) {
      return { eligible: false, reason: 'Shipper completion rate is below the minimum', score: 0 };
    }

    const score =
      100 +
      Math.min(25, profile.completedDeliveries * 0.5) +
      Math.max(0, profile.averageRating - constraints.min_shipper_rating) * 10 +
      Math.max(0, activeLimit - profile.activeDeliveries) * 5 +
      completionRate * 15;
    return { eligible: true, reason: '', score: Math.round(score * 100) / 100 };
  }

  private isCoordinate(latitude: number, longitude: number): boolean {
    return (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    );
  }
}
