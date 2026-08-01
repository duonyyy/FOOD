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
  exports: [NestMinioModule],
})
export class InfraMinioModule {}
