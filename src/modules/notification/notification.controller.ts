import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { NotificationService } from './notification.service';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getUserNotifications(@Req() req) {
    const userId = req.user.uid || req.user.id;
    return this.notificationService.getUserNotifications(userId);
  }
}
