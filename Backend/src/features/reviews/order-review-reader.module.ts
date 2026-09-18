import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from 'src/entities/review.entity';
import { OrderReviewReaderService } from './services/order-review-reader.service';

@Module({
  imports: [TypeOrmModule.forFeature([Review])],
  providers: [OrderReviewReaderService],
  exports: [OrderReviewReaderService],
})
export class OrderReviewReaderModule {}
