import { Module } from '@nestjs/common';
import { MailingService } from './send-mail.service';

@Module({
  providers: [MailingService],
  exports: [MailingService],
})
export class MailModule {}
