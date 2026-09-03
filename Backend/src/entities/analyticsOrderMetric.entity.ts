import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Analytics-owned read model. It is deliberately denormalised so dashboard
 * queries never need a repository from Ordering, Payments, or Delivery.
 */
@Entity({ name: 'analytics_order_metrics' })
@Index(['restaurantId', 'createdAt'])
@Index(['status', 'createdAt'])
@Index(['shipperId', 'deliveryCompletedAt'])
export class AnalyticsOrderMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'restaurant_id', type: 'varchar', length: 100, nullable: true })
  restaurantId: string | null;

  @Column({ name: 'customer_id', type: 'varchar', length: 100, nullable: true })
  customerId: string | null;

  @Column({ name: 'shipper_id', type: 'varchar', length: 100, nullable: true })
  shipperId: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: string;

  @Column({ name: 'payment_status', type: 'varchar', length: 50, nullable: true })
  paymentStatus: string | null;

  @Column({ name: 'payment_succeeded_at', type: 'timestamp', nullable: true })
  paymentSucceededAt: Date | null;

  @Column({ name: 'delivery_completed_at', type: 'timestamp', nullable: true })
  deliveryCompletedAt: Date | null;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @CreateDateColumn({ name: 'projected_at' })
  projectedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
