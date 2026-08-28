import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Immutable ledger entry used to rebuild Delivery earnings projections. */
@Entity({ name: 'delivery_earnings_events' })
export class DeliveryEarningsEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'idempotency_key', type: 'varchar', length: 200 })
  idempotencyKey: string;

  @Index({ unique: true })
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Index()
  @Column({ name: 'shipper_id', type: 'varchar', length: 28 })
  shipperId: string;

  @Column({ type: 'float' })
  earnings: number;

  @Column({ name: 'completed_at', type: 'timestamp' })
  completedAt: Date;

  @Column({ name: 'delivery_time_minutes', type: 'float', nullable: true })
  deliveryTimeMinutes: number | null;

  @Column({ name: 'on_time', type: 'boolean', nullable: true })
  onTime: boolean | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
