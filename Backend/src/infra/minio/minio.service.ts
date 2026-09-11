import { BadRequestException, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Client } from 'minio';
import { MINIO_CONNECTION } from 'nestjs-minio';
import { getProviderErrorCode, getProviderErrorType } from 'src/infra/logging/provider-error';
import {
  assertValidImageUpload,
  imageExtensionFor,
  type ImageContentType,
} from './image-upload.policy';

const OBJECT_VISIBILITY = {
  'restaurant-avatars': 'public',
  'restaurant-backgrounds': 'public',
  'restaurant-certificates': 'private',
} as const;

type StorageObjectPath = keyof typeof OBJECT_VISIBILITY;
type StorageObjectVisibility = (typeof OBJECT_VISIBILITY)[StorageObjectPath];

const PRIVATE_REFERENCE_SCHEME = 'storage-private://';

export interface IMinioUploadResult {
  bucket: string;
  fileName: string;
  size: number;
  contentType: ImageContentType;
  visibility: StorageObjectVisibility;
}

export function createPublicReadPolicy(bucketName: string): string {
  const publicPaths = (
    Object.entries(OBJECT_VISIBILITY) as Array<[StorageObjectPath, StorageObjectVisibility]>
  )
    .filter(([, visibility]) => visibility === 'public')
    .map(([path]) => `arn:aws:s3:::${bucketName}/${path}/*`);

  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: '*',
        Action: ['s3:GetObject'],
        Resource: publicPaths,
      },
    ],
  });
}

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  readonly bucketName: string;
  private readonly publicEndpoint: string;
  private readonly privateUrlExpirySeconds: number;

  constructor(
    @Inject(MINIO_CONNECTION) private readonly minioClient: Client,
    private readonly configService: ConfigService,
  ) {
    this.bucketName = this.configService.getOrThrow<string>('minio.bucketName');
    this.publicEndpoint = this.configService
      .getOrThrow<string>('minio.publicEndpoint')
      .replace(/\/+$/, '');
    this.privateUrlExpirySeconds = this.configService.getOrThrow<number>(
      'minio.privateUrlExpirySeconds',
    );
  }

  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName);
      }

      // Reapply this policy for existing buckets too, replacing the legacy
      // bucket-wide public read policy. Certificates remain private.
      await this.minioClient.setBucketPolicy(
        this.bucketName,
        createPublicReadPolicy(this.bucketName),
      );
      this.logger.log({ event: 'provider_initialized', provider: 'minio' });
    } catch (error) {
      this.logProviderError('initialize_bucket', error);
      throw error;
    }
  }

  async healthCheck(): Promise<void> {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);

      if (!exists) {
        throw new Error(`MinIO bucket does not exist: ${this.bucketName}`);
      }
    } catch (error) {
      this.logProviderError('health_check', error);
      throw error;
    }
  }

  assertValidImageUpload(file: Express.Multer.File): void {
    assertValidImageUpload(file);
  }

  async upload(file: Express.Multer.File, path = ''): Promise<IMinioUploadResult> {
    const contentType = assertValidImageUpload(file);
    const visibility = this.visibilityForPath(path);
    const objectName = this.createObjectName(path, contentType);

    try {
      await this.minioClient.putObject(this.bucketName, objectName, file.buffer, file.size, {
        'Content-Type': contentType,
      });
    } catch (error) {
      this.logProviderError('upload_object', error);
      throw error;
    }

    return {
      bucket: this.bucketName,
      fileName: objectName,
      size: file.size,
      contentType,
      visibility,
    };
  }

  getPublicUrl(objectName: string): string {
    if (this.visibilityForObject(objectName) !== 'public') {
      throw new BadRequestException('Private files cannot be served by a public URL');
    }
    return `${this.publicEndpoint}/${this.bucketName}/${objectName}`;
  }

  getPrivateReference(objectName: string): string {
    if (this.visibilityForObject(objectName) !== 'private') {
      throw new BadRequestException('Public files cannot be stored as private references');
    }
    return `${PRIVATE_REFERENCE_SCHEME}${this.bucketName}/${objectName}`;
  }

  async getSignedPrivateUrl(fileReference: string): Promise<string> {
    const objectName = this.objectNameFromReference(fileReference);
    if (this.visibilityForObject(objectName) !== 'private') {
      throw new BadRequestException('A signed URL can only be created for a private file');
    }

    try {
      return await this.minioClient.presignedGetObject(
        this.bucketName,
        objectName,
        this.privateUrlExpirySeconds,
      );
    } catch (error) {
      this.logProviderError('sign_private_url', error);
      throw error;
    }
  }

  async deleteFile(fileReference: string): Promise<void> {
    if (!fileReference) return;

    try {
      const objectName = this.objectNameFromReference(fileReference);
      await this.minioClient.removeObject(this.bucketName, objectName);
    } catch (error) {
      this.logProviderError('delete_object', error);
    }
  }

  private createObjectName(path: string, contentType: ImageContentType): string {
    this.visibilityForPath(path);
    return `${path}/${randomUUID()}.${imageExtensionFor(contentType)}`;
  }

  private visibilityForPath(path: string): StorageObjectVisibility {
    if (!Object.prototype.hasOwnProperty.call(OBJECT_VISIBILITY, path)) {
      throw new BadRequestException('The storage path is not allowed');
    }
    return OBJECT_VISIBILITY[path as StorageObjectPath];
  }

  private visibilityForObject(objectName: string): StorageObjectVisibility {
    const pathSegments = objectName.split('/');
    if (
      pathSegments.length !== 2 ||
      pathSegments.some(
        (segment) => !segment || segment === '.' || segment === '..' || segment.includes('\\'),
      )
    ) {
      throw new BadRequestException('Invalid storage object reference');
    }
    return this.visibilityForPath(pathSegments[0]);
  }

  private objectNameFromReference(fileReference: string): string {
    const privatePrefix = `${PRIVATE_REFERENCE_SCHEME}${this.bucketName}/`;
    const publicPrefix = `${this.publicEndpoint}/${this.bucketName}/`;
    let objectName: string;

    if (fileReference.startsWith(privatePrefix)) {
      objectName = fileReference.slice(privatePrefix.length);
    } else if (fileReference.startsWith(publicPrefix)) {
      objectName = fileReference.slice(publicPrefix.length);
    } else if (!fileReference.includes('://')) {
      objectName = fileReference;
    } else {
      throw new BadRequestException('Invalid storage file reference');
    }

    this.visibilityForObject(objectName);
    return objectName;
  }

  private logProviderError(operation: string, error: unknown): void {
    this.logger.error({
      event: 'provider_operation_failed',
      provider: 'minio',
      operation,
      errorCode: getProviderErrorCode(error),
      errorType: getProviderErrorType(error),
    });
  }
}
