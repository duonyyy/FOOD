import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from 'src/entities/review.entity';
import { ORDER_REVIEW_READER } from './contracts/order-review-reader.port';
import { OrderReviewReaderService } from './services/order-review-reader.service';

@Module({
  imports: [TypeOrmModule.forFeature([Review])],
  providers: [
    OrderReviewReaderService,
    { provide: ORDER_REVIEW_READER, useExisting: OrderReviewReaderService },
  ],
  exports: [ORDER_REVIEW_READER],
})
export class OrderReviewReaderModule {}
