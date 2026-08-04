/* eslint-disable prettier/prettier */
// src/users/entities/user.entity.ts
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ApiHideProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { AuthProvider } from 'src/auth/enums/auth-provider.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { Address } from './address.entity';
import { Checkout } from './checkout.entity';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { Order } from './order.entity';
import { Restaurant } from './restaurant.entity';
import { Role } from './role.entity';
import { ShipperCertificateInfo } from './shipperCertificateInfo.entity';

// Đăng ký enum cho GraphQL
registerEnumType(AuthProvider, {
  name: 'AuthProvider',
});

@ObjectType() // Thêm ObjectType decorator cho class
@Entity({ name: 'users' })
export class User {
  @Field(() => ID) // ID GraphQL type
  @PrimaryColumn({
    type: 'varchar',
    length: 28,
    unique: true,
    nullable: false,
  })
  id: string;

  @Field()
  @Column({ unique: true })
  username: string;

  // Không thêm @Field cho password vì lý do bảo mật
  @Exclude({ toPlainOnly: true })
  @ApiHideProperty()
  @Column()
  password: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  email: string;

  @Field(() => Role, { nullable: true })
  @ManyToOne(() => Role, (role) => role.users, { eager: true })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Field({ nullable: true })
  @Column({ nullable: true })
  name: string;

  @Field(() => [Address], { nullable: true })
  @OneToMany(() => Address, (address) => address.user, { eager: true, cascade: true })
  @JoinColumn({ name: 'address_id' })
  address: Address[];

  @Field({ nullable: true })
  @Column({ nullable: true, unique: true })
  phone: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  avatar: string;

  @Field()
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Field()
  @Column({ nullable: false })
  birthday: Date;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field({ nullable: true })
  @Column({ nullable: true })
  lastLoginAt: Date;

  @Field(() => ShipperCertificateInfo, { nullable: true })
  @OneToOne(() => ShipperCertificateInfo, (shipperCertificateInfo) => shipperCertificateInfo.user)
  shipperCertificateInfo: ShipperCertificateInfo;

  @Field(() => AuthProvider)
  @Column({ type: 'enum', enum: AuthProvider, default: AuthProvider.EMAIL })
  authProvider: AuthProvider;

  @Field({ nullable: true })
  @Exclude({ toPlainOnly: true })
  @ApiHideProperty()
  @Column({ nullable: true, name: 'google_id' })
  googleId?: string;

  // Không thêm @Field cho các thông tin nhạy cảm liên quan đến reset password
  @Exclude({ toPlainOnly: true })
  @ApiHideProperty()
  @Column({ nullable: true, name: 'reset_password_token' })
  resetPasswordToken?: string;

  @Exclude({ toPlainOnly: true })
  @ApiHideProperty()
  @Column({ nullable: true, name: 'reset_password_expires' })
  resetPasswordExpires?: Date;

  @Field(() => [Checkout], { nullable: true })
  @OneToMany(() => Checkout, (checkout) => checkout.user)
  checkouts: Checkout[];

  @Field(() => [Order], { nullable: true })
  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @Field(() => [Restaurant], { nullable: true })
  @OneToMany(() => Restaurant, (restaurant) => restaurant.owner)
  restaurants: Restaurant[];

  @Field(() => [Conversation], { nullable: true })
  @OneToMany(() => Conversation, (conversation) => conversation.participant1)
  conversationsAsParticipant1: Conversation[];

  @Field(() => [Conversation], { nullable: true })
  @OneToMany(() => Conversation, (conversation) => conversation.participant2)
  conversationsAsParticipant2: Conversation[];

  @Field(() => [Message], { nullable: true })
  @OneToMany(() => Message, (message) => message.sender)
  sentMessages: Message[];

  @Field({ nullable: true })
  @Column({ default: 0 })
  completedDeliveries: number;

  @Field({ nullable: true })
  @Column({ default: 0 })
  failedDeliveries: number;

  @Field({ nullable: true })
  @Column({ default: 0 })
  activeDeliveries: number;

  // Add these new performance tracking fields:
  @Field({ nullable: true })
  @Column({ type: 'float', default: 5.0 })
  averageRating: number;

  @Field({ nullable: true })
  @Column({ default: 0 })
  totalRatings: number;

  @Field({ nullable: true })
  @Column({ type: 'float', default: 0 })
  averageDeliveryTime: number; // in minutes

  @Field({ nullable: true })
  @Column({ default: 0 })
  onTimeDeliveries: number;

  @Field({ nullable: true })
  @Column({ default: 0 })
  lateDeliveries: number;

  @Field({ nullable: true })
  @Column({ nullable: true })
  lastActiveAt: Date;

  @Field({ nullable: true })
  @Column({ default: 0 })
  rejectedOrders: number;

  @Field({ nullable: true })
  @Column({ type: 'float', default: 0 })
  responseTimeMinutes: number; // Average time to accept/reject orders

  // thu nhap
  @Field({ nullable: true })
  @Column({ type: 'float', default: 0 })
  totalEarnings: number; // Tổng thu nhập

  @Field({ nullable: true })
  @Column({ type: 'float', default: 0 })
  monthlyEarnings: number; // Thu nhập tháng hiện tại

  @Field({ nullable: true })
  @Column({ type: 'float', default: 0 })
  weeklyEarnings: number; // Thu nhập tuần hiện tại

  @Field({ nullable: true })
  @Column({ type: 'float', default: 0 })
  dailyEarnings: number; // Thu nhập hôm nay
}
