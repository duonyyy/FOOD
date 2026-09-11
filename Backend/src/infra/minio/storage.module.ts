import { Global, Module } from '@nestjs/common';
import { STORAGE_PORT, type StoragePort } from 'src/features/system-constraints/public-api';
import { InfraMinioModule } from './infra-minio.module';
import { MinioHealthController } from './minio-health.controller';
import { MinioService } from './minio.service';

const storageProvider = {
  provide: STORAGE_PORT,
  useFactory: (minioService: MinioService): StoragePort => {
    return {
      assertValidImageUpload: (file) => minioService.assertValidImageUpload(file),
      upload: async (file, path) => {
        const result = await minioService.upload(file, path);
        return {
          fileName: result.fileName,
          url: result.visibility === 'public'
            ? minioService.getPublicUrl(result.fileName)
            : minioService.getPrivateReference(result.fileName),
        };
      },
      deleteFile: async (url) => {
        return minioService.deleteFile(url);
      },
      getSignedPrivateUrl: (fileReference) => minioService.getSignedPrivateUrl(fileReference),
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
