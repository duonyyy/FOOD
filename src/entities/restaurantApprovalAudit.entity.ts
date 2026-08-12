import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum RestaurantApprovalAction {
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity({ name: 'restaurant_approval_audits' })
@Index('IDX_restaurant_approval_audits_restaurant_id', ['restaurantId'])
@Index('IDX_restaurant_approval_audits_actor_user_id', ['actorUserId'])
export class RestaurantApprovalAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id', type: 'uuid' })
  restaurantId: string;

  @Column({ name: 'actor_user_id', type: 'uuid' })
  actorUserId: string;

  @Column({ type: 'varchar', length: 16 })
  action: RestaurantApprovalAction;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason: string | null;

  @Column({ name: 'previous_status', type: 'varchar', length: 16 })
  previousStatus: string;

  @Column({ name: 'next_status', type: 'varchar', length: 16 })
  nextStatus: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
