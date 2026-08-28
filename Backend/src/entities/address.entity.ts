// src/users/entities/user.entity.ts
import { Field, ID, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Restaurant } from './restaurant.entity';
import { User } from './user.entity';

@ObjectType() // Thêm ObjectType decorator cho class
@Entity()
export class Address {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  street: string;

  @Field()
  @Column()
  ward: string;

  @Field()
  @Column()
  district: string;

  @Field()
  @Column()
  city: string;

  @Field({ nullable: true })
  @Column({ type: 'double precision', nullable: true })
  latitude: number;

  @Field({ nullable: true })
  @Column({ type: 'double precision', nullable: true })
  longitude: number;

  @Field(() => [Restaurant], { nullable: true })
  @OneToMany(() => Restaurant, (restaurant) => restaurant.address)
  restaurants: Restaurant[];

  @Field(() => User, { nullable: true })
  @ManyToOne(() => User, (user) => user.address)
  user: User;

  @Field({ nullable: true })
  @Column({ nullable: true })
  isDefault: boolean;

  @Field({ nullable: true })
  @Column({ nullable: true })
  label: string;

  // Add this field to your Address entity
  @Column({ default: false })
  isTemporary: boolean;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}
