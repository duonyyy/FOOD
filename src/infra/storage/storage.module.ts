import { Global, Module } from '@nestjs/common';
import { STORAGE_PORT, type StoragePort } from 'src/features/system-constraints/public-api';
import { InfraMinioModule } from '../minio/infra-minio.module';
import { MinioService } from '../minio/minio.service';
import { MinioHealthController } from './minio-health.controller';

const storageProvider = {
  provide: STORAGE_PORT,
  useFactory: (minioService: MinioService): StoragePort => {
    return {
      upload: async (file, originalName, path) => {
        const result = await minioService.upload(file, originalName, path);
        return {
          fileName: result.fileName,
          url: minioService.getPublicUrl(result.fileName),
        };
      },
      deleteFile: async (url) => {
        return minioService.deleteFile(url);
      },
    };
  },
  inject: [MinioService],
};

@Global()
@Module({
  imports: [InfraMinioModule],
  controllers: [MinioHealthController],
  providers: [MinioService, storageProvider],
  exports: [MinioService, STORAGE_PORT],
})
export class StorageModule {}
