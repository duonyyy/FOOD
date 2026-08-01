Hướng Dẫn Tích Hợp MinIO Vào Dự Án NestJS
Tài liệu này hướng dẫn chi tiết cách áp dụng hệ thống lưu trữ MinIO (chuẩn S3) vào một dự án mới (đặc biệt là với NestJS) dựa trên Best Practices đã được triển khai hiệu quả.

NOTE

MinIO là một hệ thống object storage tương thích với API của Amazon S3. Việc tích hợp MinIO giúp bạn dễ dàng lưu trữ hình ảnh, tài liệu và có thể chuyển đổi sang AWS S3 sau này mà không cần sửa đổi nhiều code.

1. Cài đặt Docker (Môi trường Local)
Để chạy MinIO ở môi trường local, thêm cấu hình sau vào file docker-compose.yml của dự án:

yaml

services:
  minio:
    image: minio/minio:RELEASE.2023-09-04T19-57-37Z
    container_name: my-app-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY:-miniouser}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY:-miniopassword}
    ports:
      - '${MINIO_PORT:-9000}:9000' # API Port
      - '9001:9001'                # Console UI Port
    volumes:
      - minio-data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
volumes:
  minio-data:
    driver: local
2. Cấu Hình Môi Trường (.env)
Khai báo các biến môi trường cần thiết vào file .env:

env

MINIO_ENDPOINT=localhost
MINIO_PUBLIC_ENDPOINT=http://localhost:9000
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=miniouser
MINIO_SECRET_KEY=miniopassword
MINIO_BUCKET=my-app-bucket
3. Cài Đặt Thư Viện
Cài đặt các package cần thiết cho NestJS:

bash

npm install minio nestjs-minio
npm install -D @types/minio
4. Tích Hợp Vào Source Code NestJS
4.1. File Cấu Hình (config/minio.config.ts)
Sử dụng @nestjs/config để nạp các biến môi trường một cách an toàn.

typescript

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
4.2. Infra Module (infra-minio.module.ts)
Tạo một Module độc lập (Infrastructure Module) để thiết lập kết nối MinIO thông qua thư viện nestjs-minio.

typescript

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
4.3. MinIO Service Wrapper (minio.service.ts)
TIP

Việc xây dựng một Service Wrapper (MinioService) giúp gom toàn bộ logic upload, xử lý stream, và bucket management vào một chỗ. Các service/controller khác chỉ cần gọi hàm từ đây thay vì gọi trực tiếp Minio client.

typescript

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, CopyConditions } from 'minio';
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
  // Khởi tạo bucket và gán policy lúc module khởi động
  async onModuleInit(): Promise<void> {
    try {
      await this.createBucketIfNotExists();
      // Bỏ comment nếu bạn muốn set public read policy cho bucket
      /*
      const policy = this.buildPublicReadPolicy(this.bucketName);
      await this.minioClient.setBucketPolicy(this.bucketName, JSON.stringify(policy));
      */
      this.logger.log(`MinIO initialized — bucket: ${this.bucketName}`);
    } catch (error) {
      this.logger.error(`MinIO init failed: ${error}`);
    }
  }
  async createBucketIfNotExists(): Promise<void> {
    const exists = await this.minioClient.bucketExists(this.bucketName);
    if (!exists) {
      await this.minioClient.makeBucket(this.bucketName);
      this.logger.log(`Bucket created: ${this.bucketName}`);
    }
  }
  // Upload một file
  async upload(
    file: Express.Multer.File,
    fileName: string,
    path = '',
  ): Promise<IMinioUploadResult> {
    // Nên sanitize fileName trước khi upload
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, ''); 
    const objectName = path ? `${path}/${cleanFileName}` : cleanFileName;
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
  // Lấy URL Public của file
  getPublicUrl(objectName: string): string {
    return `${this.publicEndpoint}/${this.bucketName}/${objectName}`;
  }
  // Lấy Presigned URL (Có thời hạn)
  async getPresignedUrl(objectName: string, expiresInSeconds = 3600): Promise<string> {
    return this.minioClient.presignedGetObject(this.bucketName, objectName, expiresInSeconds);
  }
  // Xóa File
  async deleteFile(objectName: string): Promise<void> {
    if (!objectName) return;
    await this.minioClient.removeObject(this.bucketName, objectName);
  }
  // Trả về luồng file (dành cho việc download trực tiếp qua controller)
  async getObjectStream(objectName: string): Promise<NodeJS.ReadableStream> {
    return this.minioClient.getObject(this.bucketName, objectName);
  }
  // Hàm hỗ trợ build policy (Tùy chọn)
  private buildPublicReadPolicy(bucketName: string) {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucketName}/*`],
        },
      ],
    };
  }
}
5. Áp Dụng Vào Controller / Các Service Khác
Khi đã có MinioService, các service tính năng (Feature Service) chỉ việc import module chứa MinioService và gọi hàm một cách rất đơn giản:

typescript

import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MinioService } from './minio.service';
@Controller('files')
export class FilesController {
  constructor(private readonly minioService: MinioService) {}
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const result = await this.minioService.upload(file, file.originalname, 'avatars');
    return {
      url: this.minioService.getPublicUrl(result.fileName),
      data: result,
    };
  }
}
IMPORTANT

Đảm bảo bạn đã export MinioService ra ngoài module (như FileModule hoặc StorageModule) để các Module khác có thể sử dụng lại (reusability).
Với các file nhạy cảm, KHÔNG nên set public policy mà nên sử dụng tính năng Presigned URL (getPresignedUrl()) để cung cấp link download an toàn có thời hạn.