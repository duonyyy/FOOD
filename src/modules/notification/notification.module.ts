import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from 'src/entities/notification.entity';
import { NotificationController } from './notification.controller';
import { NotificationResolver } from './notification.resolver';
import { NotificationService } from './notification.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), JwtModule],
  providers: [NotificationService, NotificationResolver],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificationModule {}
