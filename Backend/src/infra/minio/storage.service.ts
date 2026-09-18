import { Injectable } from '@nestjs/common';
import { MinioService } from './minio.service';

export interface StorageUploadResult {
  fileName: string;
  url: string;
}

@Injectable()
export class StorageService {
  constructor(private readonly minioService: MinioService) {}

  assertValidImageUpload(file: Express.Multer.File): void {
    this.minioService.assertValidImageUpload(file);
  }

  async upload(file: Express.Multer.File, path?: string): Promise<StorageUploadResult> {
    const result = await this.minioService.upload(file, path);
    return {
      fileName: result.fileName,
      url:
        result.visibility === 'public'
          ? this.minioService.getPublicUrl(result.fileName)
          : this.minioService.getPrivateReference(result.fileName),
    };
  }

  deleteFile(fileReference: string): Promise<void> {
    return this.minioService.deleteFile(fileReference);
  }

  getSignedPrivateUrl(fileReference: string): Promise<string> {
    return this.minioService.getSignedPrivateUrl(fileReference);
  }
}
