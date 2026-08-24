import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppResolver } from './app.resolver';
import { AppService } from './app.service';
import { FeaturesModule } from './features/features.module';
import { InfraCoreModule } from './infra/core/infra-core.module';

@Module({
  imports: [InfraCoreModule, FeaturesModule],
  controllers: [AppController],
  providers: [AppService, AppResolver],
})
export class AppModule {}
