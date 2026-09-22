import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from 'src/common/events/events.module';
import { AnalyticsOrderMetric } from 'src/entities/analyticsOrderMetric.entity';
import { OrdersModule } from 'src/features/orders/public-api';
import { IdentityModule } from 'src/features/users/public-api';
import { DashboardController } from './controllers/dashboard.controller';
import { AnalyticsProjectionHandler } from './handlers/analytics-projection.handler';
import { AnalyticsDashboardQueryService } from './services/analytics-dashboard-query.service';
import { AnalyticsProjectionService } from './services/analytics-projection.service';
import { AnalyticsReconciliationService } from './services/analytics-reconciliation.service';
import { DashboardService } from './services/dashboard.service';

/** Owns Analytics projections, read-only dashboard query model, and admin dashboard API. */
@Module({
  imports: [
    TypeOrmModule.forFeature([AnalyticsOrderMetric]),
    EventsModule,
    OrdersModule,
    IdentityModule,
    JwtModule,
  ],
  controllers: [DashboardController],
  providers: [
    AnalyticsDashboardQueryService,
    AnalyticsProjectionService,
    AnalyticsProjectionHandler,
    AnalyticsReconciliationService,
    DashboardService,
  ],
  exports: [AnalyticsDashboardQueryService, AnalyticsReconciliationService, DashboardService],
})
export class AnalyticsModule {}
