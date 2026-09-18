import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConstraint } from '../../../entities/systemConstaints.entity';

@Injectable()
export class SystemConstraintsService {
  private readonly logger = new Logger(SystemConstraintsService.name);
  private cachedConstraints: SystemConstraint | null = null;
  private lastCacheUpdate: Date = new Date(0);
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectRepository(SystemConstraint)
    private systemConstraintsRepository: Repository<SystemConstraint>,
  ) {}

  /**
   * Get system constraints with caching - FIXED
   */
  async getConstraints(): Promise<SystemConstraint> {
    const now = new Date();

    // Check if cached constraints are still valid
    if (
      this.cachedConstraints &&
      now.getTime() - this.lastCacheUpdate.getTime() < this.CACHE_DURATION
    ) {
      return this.cachedConstraints;
    }

    try {
      this.logger.log('🔍 Fetching system constraints from database...');

      // Try to get the first (and should be only) system constraint record
      let constraints = await this.systemConstraintsRepository.findOne({
        where: {}, // Empty where clause to get any record, or you can use order and take
      });

      // If no constraints exist, create default ones
      if (!constraints) {
        this.logger.log('⚠️ No system constraints found, creating default constraints...');
        constraints = await this.createDefaultConstraints();
      }

      // Update cache
      this.cachedConstraints = constraints;
      this.lastCacheUpdate = now;

      this.logger.log(
        `✅ System constraints loaded: max_delivery_distance=${constraints.max_delivery_distance}km, min_completion_rate=${constraints.min_completion_rate}`,
      );

      return constraints;
    } catch (error: unknown) {
      this.logger.error(`❌ Error fetching system constraints: ${errorMessage(error)}`);

      // If database query fails, return cached constraints if available
      if (this.cachedConstraints) {
        this.logger.warn('⚠️ Using cached constraints due to database error');
        return this.cachedConstraints;
      }

      // Last resort: return hardcoded default constraints
      this.logger.warn('⚠️ Using hardcoded default constraints due to database error');
      return this.getHardcodedDefaults();
    }
  }

  /**
   * Create default system constraints
   */
  private async createDefaultConstraints(): Promise<SystemConstraint> {
    try {
      const defaultConstraints = new SystemConstraint();
      defaultConstraints.min_completion_rate = 0.7;
      defaultConstraints.min_total_orders = 10;
      defaultConstraints.max_active_deliveries = 3;
      defaultConstraints.max_delivery_distance = 30;
      defaultConstraints.min_shipper_rating = 3.5;
      defaultConstraints.max_delivery_time_min = 45;
      defaultConstraints.base_distance_km = 5;
      defaultConstraints.base_shipping_fee = 15000;
      defaultConstraints.tier2_distance_km = 10;
      defaultConstraints.tier2_shipping_fee = 25000;
      defaultConstraints.tier3_shipping_fee = 35000;

      const savedConstraints = await this.systemConstraintsRepository.save(defaultConstraints);
      this.logger.log('✅ Default system constraints created successfully');

      return savedConstraints;
    } catch (error: unknown) {
      this.logger.error(`❌ Error creating default constraints: ${errorMessage(error)}`);
      return this.getHardcodedDefaults();
    }
  }

  /**
   * Get hardcoded defaults as fallback
   */
  private getHardcodedDefaults(): SystemConstraint {
    const constraints = new SystemConstraint();
    constraints.min_completion_rate = 0.7;
    constraints.min_total_orders = 10;
    constraints.max_active_deliveries = 3;
    constraints.max_delivery_distance = 30;
    constraints.min_shipper_rating = 3.5;
    constraints.max_delivery_time_min = 45;
    constraints.base_distance_km = 5;
    constraints.base_shipping_fee = 15000;
    constraints.tier2_distance_km = 10;
    constraints.tier2_shipping_fee = 25000;
    constraints.tier3_shipping_fee = 35000;

    return constraints;
  }

  /**
   * Calculate shipping fee based on distance - ENHANCED
   */
  async calculateShippingFee(distanceKm: number): Promise<number> {
    try {
      const constraints = await this.getConstraints();

      if (distanceKm <= constraints.base_distance_km) {
        return constraints.base_shipping_fee;
      } else if (distanceKm <= constraints.tier2_distance_km) {
        return constraints.tier2_shipping_fee;
      } else {
        return constraints.tier3_shipping_fee;
      }
    } catch (error: unknown) {
      this.logger.error(`Error calculating shipping fee: ${errorMessage(error)}`);
      // Fallback to hardcoded tiers
      if (distanceKm <= 5) return 15000;
      if (distanceKm <= 10) return 25000;
      return 35000;
    }
  }

  /**
   * Check if distance is within delivery limits
   */
  async isDistanceWithinLimits(distanceKm: number): Promise<boolean> {
    try {
      const constraints = await this.getConstraints();
      return distanceKm <= constraints.max_delivery_distance;
    } catch (error: unknown) {
      this.logger.error(`Error checking distance limits: ${errorMessage(error)}`);
      return distanceKm <= 30; // Fallback limit
    }
  }

  /**
   * Get maximum delivery time in minutes
   */
  async getMaxDeliveryTime(): Promise<number> {
    try {
      const constraints = await this.getConstraints();
      return constraints.max_delivery_time_min;
    } catch (error: unknown) {
      this.logger.error(`Error getting max delivery time: ${errorMessage(error)}`);
      return 45; // Fallback value
    }
  }

  /**
   * Get maximum delivery distance in kilometers
   */
  async getMaxDeliveryDistance(): Promise<number> {
    try {
      const constraints = await this.getConstraints();
      return constraints.max_delivery_distance;
    } catch (error: unknown) {
      this.logger.error(`Error getting max delivery distance: ${errorMessage(error)}`);
      return 30; // Fallback value
    }
  }

  /**
   * Get shipper commission rate from system settings
   */
  getShipperCommissionRate(): Promise<number> {
    // This could be configurable in the database, for now default to 80%
    return Promise.resolve(0.8);
  }

  /**
   * Calculate shipper earnings from shipping fee
   */
  async calculateShipperEarnings(shippingFee: number): Promise<number> {
    const commissionRate = await this.getShipperCommissionRate();
    return Math.round(shippingFee * commissionRate);
  }

  /**
   * Get comprehensive delivery fee breakdown
   */
  async getDeliveryFeeBreakdown(distance: number): Promise<{
    distance: number;
    shippingFee: number;
    shipperEarnings: number;
    platformFee: number;
    commissionRate: number;
    feeStructure: string;
  }> {
    try {
      const shippingFee = await this.calculateShippingFee(distance);
      const shipperEarnings = await this.calculateShipperEarnings(shippingFee);
      const platformFee = shippingFee - shipperEarnings;
      const commissionRate = await this.getShipperCommissionRate();

      let feeStructure = '';
      if (distance <= 5) {
        feeStructure = 'Tier 1: 0-5km';
      } else if (distance <= 10) {
        feeStructure = 'Tier 2: 5-10km';
      } else {
        feeStructure = 'Tier 3: 10km+';
      }

      return {
        distance: Math.round(distance * 100) / 100,
        shippingFee,
        shipperEarnings,
        platformFee,
        commissionRate,
        feeStructure,
      };
    } catch (error: unknown) {
      this.logger.error(`Error getting delivery fee breakdown: ${errorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Update system constraints (admin only)
   */
  async updateConstraints(updates: Partial<SystemConstraint>): Promise<SystemConstraint> {
    try {
      let constraints = await this.systemConstraintsRepository.findOne({
        where: {}, // Get any existing record
      });

      if (!constraints) {
        constraints = await this.createDefaultConstraints();
      }

      // Apply updates
      Object.assign(constraints, updates);

      const updated = await this.systemConstraintsRepository.save(constraints);

      // Clear cache to force reload
      this.clearCache();

      this.logger.log('✅ System constraints updated successfully');
      return updated;
    } catch (error: unknown) {
      this.logger.error(`Error updating constraints: ${errorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Clear cache (useful for testing or manual cache refresh)
   */
  clearCache(): void {
    this.cachedConstraints = null;
    this.lastCacheUpdate = new Date(0);
    this.logger.log('🗑️ System constraints cache cleared');
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
