import { Module } from '@nestjs/common';
import { ReviewModule } from '../../modules/review/review.module';

/** Compatibility shell for review ownership. */
@Module({ imports: [ReviewModule] })
export class ReviewsModule {}
