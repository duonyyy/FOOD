import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MinioService } from '../minio/minio.service';

@Controller('minio/health')
@ApiTags('system')
export class MinioHealthController {
  constructor(private readonly minioService: MinioService) {}

  @Get('live')
  @ApiOperation({ summary: 'Check API connectivity to MinIO' })
  @ApiResponse({ status: 200, description: 'MinIO bucket is reachable from the API' })
  @ApiResponse({ status: 503, description: 'MinIO is unavailable from the API' })
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
