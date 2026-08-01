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

        // Set public read policy so images are accessible via URL
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
      } else {
        this.logger.log(`MinIO initialized — bucket already exists: ${this.bucketName}`);
      }
    } catch (error) {
      this.logger.error(`MinIO init failed: ${error}`);
    }
  }

  async healthCheck(): Promise<void> {
    const exists = await this.minioClient.bucketExists(this.bucketName);

    if (!exists) {
      throw new Error(`MinIO bucket does not exist: ${this.bucketName}`);
    }
  }

  async upload(
    file: Express.Multer.File,
    fileName: string,
    path = '',
  ): Promise<IMinioUploadResult> {
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const objectName = path
      ? `${path}/${Date.now()}-${cleanFileName}`
      : `${Date.now()}-${cleanFileName}`;

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
    // If a full URL is passed in, extract just the object name
    if (fileUrl.startsWith(this.publicEndpoint)) {
      const parts = fileUrl.split(`${this.bucketName}/`);
      if (parts.length > 1) objectName = parts[1];
    }

    await this.minioClient.removeObject(this.bucketName, objectName).catch(() => {});
  }
}
