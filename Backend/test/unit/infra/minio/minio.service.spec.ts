import { BadRequestException } from '@nestjs/common';
import { type ConfigService } from '@nestjs/config';
import { type Client } from 'minio';
import { createPublicReadPolicy, MinioService } from 'src/infra/minio/minio.service';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function imageFile(buffer = PNG_BYTES, mimetype = 'image/png'): Express.Multer.File {
  return {
    buffer,
    size: buffer.length,
    mimetype,
    originalname: '../../malware.exe',
  } as Express.Multer.File;
}

describe('MinioService', () => {
  const minioClient = {
    bucketExists: jest.fn(),
    makeBucket: jest.fn(),
    setBucketPolicy: jest.fn(),
    putObject: jest.fn(),
    removeObject: jest.fn(),
    presignedGetObject: jest.fn(),
  };
  const configService = {
    getOrThrow: jest.fn((key: string) => {
      const config: Record<string, string | number> = {
        'minio.bucketName': 'foodee',
        'minio.publicEndpoint': 'https://files.example.test/',
        'minio.privateUrlExpirySeconds': 900,
      };
      return config[key];
    }),
  };
  let service: MinioService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MinioService(
      minioClient as unknown as Client,
      configService as unknown as ConfigService,
    );
  });

  it('only grants public reads to avatar and background prefixes', async () => {
    minioClient.bucketExists.mockResolvedValue(true);

    await service.onModuleInit();

    const policyJson = createPublicReadPolicy('foodee');
    expect(minioClient.setBucketPolicy).toHaveBeenCalledWith('foodee', policyJson);
    const policy = JSON.parse(policyJson) as {
      Statement: Array<{ Resource: string[] }>;
    };
    expect(policy.Statement[0].Resource).toEqual([
      'arn:aws:s3:::foodee/restaurant-avatars/*',
      'arn:aws:s3:::foodee/restaurant-backgrounds/*',
    ]);
    expect(JSON.stringify(policy)).not.toContain('restaurant-certificates');
  });

  it('stores an image with a server-generated key and detected content type', async () => {
    minioClient.putObject.mockResolvedValue({});

    const upload = await service.upload(imageFile(), 'restaurant-avatars');

    expect(upload.fileName).toMatch(/^restaurant-avatars\/[0-9a-f-]+\.png$/);
    expect(upload.fileName).not.toContain('malware');
    expect(minioClient.putObject).toHaveBeenCalledWith(
      'foodee',
      upload.fileName,
      PNG_BYTES,
      PNG_BYTES.length,
      { 'Content-Type': 'image/png' },
    );
  });

  it.each([
    ['an executable renamed as jpeg', Buffer.from('MZ executable'), 'image/jpeg'],
    ['an SVG upload', Buffer.from('<svg><script>alert(1)</script></svg>'), 'image/svg+xml'],
    ['forged PNG content type', PNG_BYTES, 'image/jpeg'],
    ['arbitrary bytes', Buffer.from('not an image'), 'image/png'],
  ])('rejects %s', (_name, buffer, mimetype) => {
    expect(() => service.assertValidImageUpload(imageFile(buffer, mimetype))).toThrow(
      BadRequestException,
    );
  });

  it('rejects an oversized image before it is uploaded', () => {
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1);
    PNG_BYTES.copy(oversized);

    expect(() => service.assertValidImageUpload(imageFile(oversized))).toThrow(BadRequestException);
    expect(minioClient.putObject).not.toHaveBeenCalled();
  });

  it('rejects a client-controlled storage path', async () => {
    await expect(service.upload(imageFile(), '../restaurant-certificates')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(minioClient.putObject).not.toHaveBeenCalled();
  });

  it('keeps certificates private and only signs their private reference', async () => {
    minioClient.presignedGetObject.mockResolvedValue('https://signed.example.test/certificate');
    const objectName = 'restaurant-certificates/123e4567-e89b-12d3-a456-426614174000.png';
    const reference = service.getPrivateReference(objectName);

    expect(() => service.getPublicUrl(objectName)).toThrow(BadRequestException);
    await expect(service.getSignedPrivateUrl(reference)).resolves.toBe(
      'https://signed.example.test/certificate',
    );
    expect(minioClient.presignedGetObject).toHaveBeenCalledWith('foodee', objectName, 900);
  });

  it('builds a certificate-safe public policy deterministically', () => {
    expect(createPublicReadPolicy('foodee')).not.toContain('restaurant-certificates');
  });
});
