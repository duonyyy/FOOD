import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Notification } from 'src/entities/notification.entity';
import { Repository } from 'typeorm';
import { NotificationListResponseDto } from './dto/notification-list-response.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  /**
   * Persist a new notification. Called exclusively by the event handler.
   */
  async create(params: {
    recipientUserId: string;
    description: string;
    content: string;
    type: string;
    idempotencyKey?: string;
  }): Promise<Notification> {
    const notification = await this.notificationRepo.save({
      receiveUser: params.recipientUserId,
      description: params.description,
      content: params.content,
      type: params.type,
      isRead: false,
      idempotencyKey: params.idempotencyKey ?? null,
    });

    this.logger.log(
      `Notification created: id=${notification.id}, type=${params.type}, recipient=${params.recipientUserId}`,
    );

    return notification;
  }

  /**
   * Event consumers must use this method. The database unique index makes an
   * event replay safe even when two handlers race.
   */
  async createFromEvent(params: {
    recipientUserId: string;
    description: string;
    content: string;
    type: string;
    idempotencyKey: string;
  }): Promise<{ notification: Notification; created: boolean }> {
    const existing = await this.notificationRepo.findOne({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existing) return { notification: existing, created: false };

    try {
      const notification = await this.create(params);
      return { notification, created: true };
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;

      const duplicate = await this.notificationRepo.findOne({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (duplicate) return { notification: duplicate, created: false };
      throw error;
    }
  }

  /**
   * Return paginated notifications for a user, newest first.
   */
  async findByUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<NotificationListResponseDto> {
    const [entities, total] = await this.notificationRepo.findAndCount({
      where: { receiveUser: userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: entities.map((e) => this.toResponseDto(e)),
      total,
    };
  }

  /**
   * Mark a notification as read. Only the recipient may do this.
   */
  async markAsRead(notificationId: string, actorUserId: string): Promise<NotificationResponseDto> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${notificationId} not found`);
    }

    if (notification.receiveUser !== actorUserId) {
      throw new ForbiddenException("Cannot mark another user's notification as read");
    }

    notification.isRead = true;
    const saved = await this.notificationRepo.save(notification);
    return this.toResponseDto(saved);
  }

  private toResponseDto(entity: Notification): NotificationResponseDto {
    const dto = new NotificationResponseDto();
    dto.id = entity.id;
    dto.description = entity.description;
    dto.content = entity.content;
    dto.type = entity.type;
    dto.isRead = entity.isRead;
    dto.createdAt = entity.createdAt;
    return dto;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === '23505'
    );
  }
}
