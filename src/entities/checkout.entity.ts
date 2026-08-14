import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json'; // Bạn cần cài package này

export enum CheckoutStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

// Đăng ký enum với GraphQL
registerEnumType(CheckoutStatus, {
  name: 'CheckoutStatus',
});

@ObjectType() // Thêm decorator ObjectType
@Entity('checkouts')
export class Checkout {
  @Field(() => ID) // Thêm Field decorator
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field({ nullable: true })
  @Column({ type: 'uuid', nullable: true })
  orderId: string;

  @Field()
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Field()
  @Column({ type: 'varchar', length: 3, default: 'VND' })
  currency: string;

  @Field()
  @Column({ type: 'varchar', length: 50 })
  paymentMethod: string;

  @Field({ nullable: true })
  @Column({ type: 'varchar', nullable: true })
  paymentIntentId: string;

  /** Provider transaction id from a verified callback; never client supplied. */
  @Column({ type: 'varchar', nullable: true })
  providerTransactionId?: string;

  /** Internal key used to make a replayed provider callback a no-op. */
  @Column({ type: 'varchar', nullable: true })
  webhookIdempotencyKey?: string;

  @Field({ nullable: true })
  // Redirect URLs are returned to the caller but are never persisted because
  // provider URLs can contain signed, short-lived secrets.
  paymentUrl: string;

  @Field(() => CheckoutStatus)
  @Column({
    type: 'enum',
    enum: CheckoutStatus,
    default: CheckoutStatus.PENDING,
  })
  status: CheckoutStatus;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true, name: 'paymentDetails' })
  providerMetadata: Record<string, unknown>;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

}
