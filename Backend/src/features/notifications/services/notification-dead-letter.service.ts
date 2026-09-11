import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationDeadLetter } from 'src/entities/notification-dead-letter.entity';
import { Repository } from 'typeorm';

export interface NotificationDeadLetterRequest {
  idempotencyKey: string;
  eventType: string;
  recipientUserId: string;
  payload: Record<string, unknown>;
  error: string;
}

@Injectable()
export class NotificationDeadLetterService {
  private readonly logger = new Logger(NotificationDeadLetterService.name);

  constructor(
    @InjectRepository(NotificationDeadLetter)
    private readonly repository: Repository<NotificationDeadLetter>,
  ) {}

  async record(request: NotificationDeadLetterRequest): Promise<void> {
    try {
      const existing = await this.repository.findOne({
        where: { idempotencyKey: request.idempotencyKey },
      });
      if (existing) {
        existing.attempts += 1;
        existing.lastError = request.error;
        existing.payload = request.payload;
        await this.repository.save(existing);
        return;
      }

      await this.repository.save({
        idempotencyKey: request.idempotencyKey,
        eventType: request.eventType,
        recipientUserId: request.recipientUserId,
        payload: request.payload,
        attempts: 1,
        lastError: request.error,
      });
    } catch (error) {
      this.logger.error(
        `notification_dead_letter_write_failed key=${request.idempotencyKey}: ${this.errorMessage(error)}`,
      );
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
