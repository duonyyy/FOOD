import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Food } from 'src/entities/food.entity';
import { Restaurant } from 'src/entities/restaurant.entity';
import { Review } from 'src/entities/review.entity';
import { User } from 'src/entities/user.entity';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [TypeOrmModule.forFeature([Review, User, Restaurant, Food]), JwtModule],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
