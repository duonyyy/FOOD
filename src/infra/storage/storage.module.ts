import { Module } from '@nestjs/common';
import { InfraMinioModule } from '../minio/infra-minio.module';
import { MinioService } from '../minio/minio.service';

@Module({
  imports: [InfraMinioModule],
  providers: [MinioService],
  exports: [MinioService],
})
export class StorageModule {}
