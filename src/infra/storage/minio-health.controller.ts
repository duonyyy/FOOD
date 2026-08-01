import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MinioService } from '../minio/minio.service';

@Controller('minio/health')
export class MinioHealthController {
  constructor(private readonly minioService: MinioService) {}

  @Get('live')
  async live() {
    try {
      await this.minioService.healthCheck();

      return {
        status: 'ok',
        service: 'minio',
        bucket: this.minioService.bucketName,
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'minio',
      });
    }
  }
}
