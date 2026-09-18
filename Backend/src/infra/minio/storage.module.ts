import { Global, Module } from '@nestjs/common';
import { InfraMinioModule } from './infra-minio.module';
import { MinioHealthController } from './minio-health.controller';
import { MinioService } from './minio.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  imports: [InfraMinioModule],
  controllers: [MinioHealthController],
  providers: [MinioService, StorageService],
  exports: [MinioService, StorageService],
})
export class StorageModule {}
