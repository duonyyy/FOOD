// src/users/entities/user.entity.ts
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Food } from './food.entity';
import { User } from './user.entity';

// Define and register enum for review types
export const ReviewType = {
  FOOD: 'food',
  SHIPPER: 'shipper',
} as const;

export type ReviewType = (typeof ReviewType)[keyof typeof ReviewType];

registerEnumType(ReviewType, {
  name: 'ReviewType',
});

@ObjectType() // Add ObjectType decorator for GraphQL
@Entity({ name: 'reviews' })
export class Review {
  @Field(() => ID) // Add Field decorator for GraphQL
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => User)
  @ManyToOne(() => User) // Remove eager: true to avoid circular loading
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Field(() => Food, { nullable: true })
  @ManyToOne(() => Food) // Remove eager: true to avoid circular loading
  @JoinColumn({ name: 'food_id' })
  food: Food;

  /**
   * Required by the Reviews API for every newly-created review. It remains nullable
   * at persistence level only so historic reviews without an order reference remain readable.
   */
  @Column({ type: 'uuid', nullable: true, name: 'order_id' })
  orderId: string | null;

  @Field({ nullable: true })
  @Column({ nullable: true })
  image: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  comment: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  rating: number;

  @Field(() => ReviewType)
  @Column({ type: 'enum', enum: ['food', 'shipper'] })
  type: ReviewType;

  @Field(() => User, { nullable: true })
  @ManyToOne(() => User) // Remove eager: true to avoid circular loading
  @JoinColumn({ name: 'shipper_id' })
  shipper: User;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}
