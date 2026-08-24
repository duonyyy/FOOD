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
