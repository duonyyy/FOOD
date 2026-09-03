import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AnalyticsModule } from 'src/features/analytics/public-api';
import { UsersModule } from '../users/users.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  // UsersModule is required only by RolesGuard; Dashboard never receives its repository.
  imports: [AnalyticsModule, JwtModule, UsersModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
