import { Module } from '@nestjs/common';
import { InfraMinioModule } from '../minio/infra-minio.module';
import { MinioService } from '../minio/minio.service';
import { MinioHealthController } from './minio-health.controller';

@Module({
  imports: [InfraMinioModule],
  controllers: [MinioHealthController],
  providers: [MinioService],
  exports: [MinioService],
})
export class StorageModule {}
