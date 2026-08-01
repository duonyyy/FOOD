# Task 2: Tạo Minio Config, Module và Service

## Mục đích
Viết các file cấu hình và Service MinIO trong NestJS.

## Hướng dẫn chi tiết từng bước

### 1. Cài đặt Dependencies
Mở terminal tại thư mục `foodee-be` và chạy:
```bash
npm install minio nestjs-minio
npm install -D @types/minio
```

### 2. Tạo file Cấu hình (`src/config/minio.config.ts`)
Tạo thư mục/file mới và dán đoạn code sau:

```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('minio', () => ({
  endPoint: process.env['MINIO_ENDPOINT'] || 'localhost',
  publicEndpoint: process.env['MINIO_PUBLIC_ENDPOINT'] || 'http://localhost:9000',
  port: process.env['MINIO_PORT'] ? parseInt(process.env['MINIO_PORT'], 10) : 9000,
  useSSL: process.env['MINIO_USE_SSL'] === 'true',
  accessKey: process.env['MINIO_ACCESS_KEY'],
  secretKey: process.env['MINIO_SECRET_KEY'],
  bucketName: process.env['MINIO_BUCKET'],
}));
```

*(Lưu ý: Mở file `src/app.module.ts`, đảm bảo đã đưa `minioConfig` vào mảng load của `ConfigModule.forRoot`)*.

### 3. Tạo Infra Module (`src/infra/minio/infra-minio.module.ts`)
Tạo file với nội dung:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestMinioModule } from 'nestjs-minio';

@Module({
  imports: [
    NestMinioModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        endPoint: configService.get<string>('minio.endPoint'),
        port: configService.get<number>('minio.port'),
        useSSL: configService.get<boolean>('minio.useSSL'),
        accessKey: configService.get<string>('minio.accessKey'),
        secretKey: configService.get<string>('minio.secretKey'),
      }),
    }),
  ],
  exports: [NestMinioModule]
})
export class InfraMinioModule {}
```

### 4. Tạo Minio Service (`src/infra/minio/minio.service.ts`)
Tạo file với nội dung:

```typescript
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { MINIO_CONNECTION } from 'nestjs-minio';

export interface IMinioUploadResult {
  bucket: string;
  fileName: string;
  size: number;
  contentType: string;
}

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  readonly bucketName: string;
  private readonly publicEndpoint: string;

  constructor(
    @Inject(MINIO_CONNECTION) private readonly minioClient: Client,
    private readonly configService: ConfigService,
  ) {
    this.bucketName = this.configService.getOrThrow<string>('minio.bucketName');
    this.publicEndpoint = this.configService.getOrThrow<string>('minio.publicEndpoint');
  }

  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName);
        
        // Thiết lập policy để ai cũng có thể xem ảnh qua web
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucketName}/*`],
            },
          ],
        };
        await this.minioClient.setBucketPolicy(this.bucketName, JSON.stringify(policy));
        this.logger.log(`Bucket created and public read policy set: ${this.bucketName}`);
      }
    } catch (error) {
      this.logger.error(`MinIO init failed: ${error}`);
    }
  }

  async upload(
    file: Express.Multer.File,
    fileName: string,
    path = '',
  ): Promise<IMinioUploadResult> {
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, ''); 
    const objectName = path ? `${path}/${Date.now()}-${cleanFileName}` : `${Date.now()}-${cleanFileName}`;
    
    await this.minioClient.putObject(
      this.bucketName,
      objectName,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype },
    );

    return {
      bucket: this.bucketName,
      fileName: objectName,
      size: file.size,
      contentType: file.mimetype,
    };
  }

  getPublicUrl(objectName: string): string {
    return `${this.publicEndpoint}/${this.bucketName}/${objectName}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl) return;
    
    let objectName = fileUrl;
    // Nếu truyền cả URL vào (chứa endpoint), cắt lấy object name
    if (fileUrl.startsWith(this.publicEndpoint)) {
       const parts = fileUrl.split(`${this.bucketName}/`);
       if (parts.length > 1) objectName = parts[1];
    }
    
    await this.minioClient.removeObject(this.bucketName, objectName).catch(() => {});
  }
}
```
