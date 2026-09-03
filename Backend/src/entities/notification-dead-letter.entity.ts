import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Durable record for notifications that exhausted the immediate retry budget.
 * It is operational data only; it is never part of the source domain transaction.
 */
@Entity({ name: 'notification_dead_letters' })
@Index('UQ_notification_dead_letters_idempotency_key', ['idempotencyKey'], { unique: true })
export class NotificationDeadLetter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 200 })
  idempotencyKey: string;

  @Column({ name: 'event_type', type: 'varchar', length: 150 })
  eventType: string;

  @Column({ name: 'recipient_user_id', type: 'varchar', length: 100 })
  recipientUserId: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'int', default: 1 })
  attempts: number;

  @Column({ name: 'last_error', type: 'text' })
  lastError: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
