import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Delivery-owned shipper state.
 *
 * `userId` is intentionally a scalar reference. Delivery must not depend on
 * Identity's User entity just to read or persist shipper state.
 */
@Entity({ name: 'shipper_profiles' })
export class ShipperProfile {
  @PrimaryColumn({ name: 'user_id', type: 'varchar', length: 28 })
  userId: string;

  @Column({ name: 'cccd', nullable: true })
  cccd: string | null;

  @Column({ name: 'driver_license', nullable: true })
  driverLicense: string | null;

  @Column({ name: 'certificate_status', type: 'varchar', length: 20, default: 'PENDING' })
  certificateStatus: string;

  @Column({ name: 'certificate_verified_at', type: 'timestamp', nullable: true })
  certificateVerifiedAt: Date | null;

  @Column({ name: 'is_available', default: true })
  isAvailable: boolean;

  @Column({ name: 'max_active_deliveries', type: 'integer', default: 3 })
  maxActiveDeliveries: number;

  @Column({ name: 'service_radius_km', type: 'float', default: 10 })
  serviceRadiusKm: number;

  @Column({ name: 'completed_deliveries', type: 'integer', default: 0 })
  completedDeliveries: number;

  @Column({ name: 'failed_deliveries', type: 'integer', default: 0 })
  failedDeliveries: number;

  @Column({ name: 'active_deliveries', type: 'integer', default: 0 })
  activeDeliveries: number;

  @Column({ name: 'average_rating', type: 'float', default: 5 })
  averageRating: number;

  @Column({ name: 'total_ratings', type: 'integer', default: 0 })
  totalRatings: number;

  @Column({ name: 'average_delivery_time', type: 'float', default: 0 })
  averageDeliveryTime: number;

  @Column({ name: 'on_time_deliveries', type: 'integer', default: 0 })
  onTimeDeliveries: number;

  @Column({ name: 'late_deliveries', type: 'integer', default: 0 })
  lateDeliveries: number;

  @Column({ name: 'last_active_at', type: 'timestamp', nullable: true })
  lastActiveAt: Date | null;

  @Column({ name: 'rejected_orders', type: 'integer', default: 0 })
  rejectedOrders: number;

  @Column({ name: 'response_time_minutes', type: 'float', default: 0 })
  responseTimeMinutes: number;

  @Column({ name: 'total_earnings', type: 'float', default: 0 })
  totalEarnings: number;

  @Column({ name: 'monthly_earnings', type: 'float', default: 0 })
  monthlyEarnings: number;

  @Column({ name: 'weekly_earnings', type: 'float', default: 0 })
  weeklyEarnings: number;

  @Column({ name: 'daily_earnings', type: 'float', default: 0 })
  dailyEarnings: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
