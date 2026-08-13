/* eslint-disable prettier/prettier */
// src/users/entities/user.entity.ts
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Food } from './food.entity';
import { Order } from './order.entity';

@ObjectType() // Thêm ObjectType decorator cho class
@Entity({ name: 'orderDetails' })
export class OrderDetail {
  @Field(() => ID) // Thêm Field decorator cho ID
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => Order)
  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Field(() => Food)
  @ManyToOne(() => Food, { eager: true })
  @JoinColumn({ name: 'food_id' })
  food: Food;

  @Field({ nullable: true })
  @Column({ nullable: true })
  varity: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  quantity: number;

  @Field({ nullable: true })
  @Column({ nullable: true })
  price: string;

  @Field({ nullable: true })
  @Column({ nullable: true, name: 'food_name_snapshot' })
  foodNameSnapshot: string;

  @Field({ nullable: true })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'unit_price_snapshot' })
  unitPriceSnapshot: number;

  @Field({ nullable: true })
  @Column({ nullable: true })
  note: string;

  // Add selected toppings as JSON column
  @Field(() => [String], { nullable: true })
  @Column({ type: 'simple-json', nullable: true, name: 'selected_toppings' })
  selectedToppings?: Array<{
    id: string;
    name: string;
    price: number;
  }>;

  // Add total topping price
  @Field({ nullable: true })
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'topping_total' })
  toppingTotal?: number;
}
