/* eslint-disable prettier/prettier */
// src/users/entities/user.entity.ts
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Food } from './food.entity';

@ObjectType() // Thêm ObjectType decorator cho class
@Entity({ name: 'categories' })
@Index('IDX_categories_name', ['name'], { unique: true })
export class Category {
  @Field(() => ID) // Thêm Field decorator cho ID
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  name: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  image: string;

  @Field(() => [Food], { nullable: true })
  @OneToMany(() => Food, (food) => food.category, {
    onDelete: 'SET NULL',
  })
  foods: Food[];
}
