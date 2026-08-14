import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Promotion } from './promotion.entity';

export enum PromotionRedemptionStatus {
  RESERVED = 'reserved',
  COMMITTED = 'committed',
  RELEASED = 'released',
}

@Entity({ name: 'promotion_redemptions' })
@Unique('UQ_promotion_redemptions_order_id', ['orderId'])
export class PromotionRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'customer_id', type: 'varchar', length: 28 })
  customerId: string;

  @ManyToOne(() => Promotion, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'promotion_id' })
  promotion: Promotion;

  @Column({ name: 'promotion_code', type: 'varchar', length: 100 })
  promotionCode: string;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'enum', enum: PromotionRedemptionStatus })
  status: PromotionRedemptionStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
