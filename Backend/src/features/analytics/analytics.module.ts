import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from 'src/common/events/events.module';
import { AnalyticsOrderMetric } from 'src/entities/analyticsOrderMetric.entity';
import { OrdersModule } from 'src/features/orders/public-api';
import { AnalyticsDashboardQueryService } from './analytics-dashboard-query.service';
import { AnalyticsProjectionHandler } from './analytics-projection.handler';
import { AnalyticsProjectionService } from './analytics-projection.service';
import { AnalyticsReconciliationService } from './analytics-reconciliation.service';

/** Owns Analytics projections and the read-only dashboard query model. */
@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsOrderMetric]), EventsModule, OrdersModule],
  providers: [
    AnalyticsDashboardQueryService,
    AnalyticsProjectionService,
    AnalyticsProjectionHandler,
    AnalyticsReconciliationService,
  ],
  exports: [AnalyticsDashboardQueryService, AnalyticsReconciliationService],
})
export class AnalyticsModule {}
