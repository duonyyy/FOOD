// src/users/entities/user.entity.ts
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@ObjectType() // Thêm ObjectType decorator cho class
@Entity({ name: 'notifications' })
@Index('UQ_notifications_idempotency_key', ['idempotencyKey'], { unique: true })
export class Notification {
  @Field(() => ID) // Thêm Field decorator cho ID
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  description: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  content: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  receiveUser: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field({ nullable: true })
  @Column({ nullable: true, default: false })
  isRead: boolean;

  @Field({ nullable: true })
  @Column({ nullable: true })
  type: string;

  /** Stable source-event key used to make event replay safe. */
  @Column({ name: 'idempotency_key', type: 'varchar', length: 200, nullable: true })
  idempotencyKey: string | null;
}
