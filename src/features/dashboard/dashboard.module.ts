import { Module } from '@nestjs/common';
import { DashboardModule as LegacyDashboardModule } from '../../modules/dashboard/dashboard.module';

/** Compatibility shell for reporting and read-model ownership. */
@Module({ imports: [LegacyDashboardModule] })
export class DashboardModule {}
