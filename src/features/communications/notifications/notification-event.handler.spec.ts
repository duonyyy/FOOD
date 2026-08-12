import { Test, TestingModule } from '@nestjs/testing';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import { NOTIFICATION_REQUESTED_EVENT } from 'src/common/events/notification-requested.event';
import { Notification } from 'src/entities/notification.entity';
import { pubSub } from 'src/pubsub';
import { NotificationEventHandler } from './notification-event.handler';
import { NotificationService } from './notification.service';

jest.mock('src/pubsub', () => ({
  pubSub: { publish: jest.fn() },
}));

describe('NotificationEventHandler', () => {
  let handler: NotificationEventHandler;
  let eventBus: InProcessEventBus;
  let notificationService: { create: jest.Mock };

  beforeEach(async () => {
    notificationService = {
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationEventHandler,
        InProcessEventBus,
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    handler = module.get(NotificationEventHandler);
    eventBus = module.get(InProcessEventBus);

    // Init the handler (subscribes to event bus)
    handler.onModuleInit();
  });

  afterEach(() => {
    handler.onModuleDestroy();
    jest.clearAllMocks();
  });

  it('subscribes to NOTIFICATION_REQUESTED_EVENT and creates notification', async () => {
    const savedNotification = { id: 'n1', receiveUser: 'user-1' } as Notification;
    notificationService.create.mockResolvedValue(savedNotification);

    await eventBus.publish(NOTIFICATION_REQUESTED_EVENT, {
      recipientUserId: 'user-1',
      description: 'Test',
      content: 'Test content',
      type: 'order',
    });

    expect(notificationService.create).toHaveBeenCalledWith({
      recipientUserId: 'user-1',
      description: 'Test',
      content: 'Test content',
      type: 'order',
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(pubSub.publish).toHaveBeenCalledWith('notificationAdded', {
      notificationAdded: savedNotification,
    });
  });

  it('retries once on failure then logs error', async () => {
    const error = new Error('DB connection lost');
    notificationService.create.mockRejectedValue(error);

    // Should not throw — errors are swallowed
    await eventBus.publish(NOTIFICATION_REQUESTED_EVENT, {
      recipientUserId: 'user-1',
      description: 'Test',
      content: 'Test content',
      type: 'order',
    });

    // Should have been called twice (initial + 1 retry)
    expect(notificationService.create).toHaveBeenCalledTimes(2);
  });

  it('does not publish to PubSub when creation fails', async () => {
    notificationService.create.mockRejectedValue(new Error('fail'));

    await eventBus.publish(NOTIFICATION_REQUESTED_EVENT, {
      recipientUserId: 'user-1',
      description: 'Test',
      content: 'Test content',
      type: 'order',
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(pubSub.publish).not.toHaveBeenCalled();
  });

  it('does not persist a duplicate notification when GraphQL publication fails', async () => {
    const savedNotification = { id: 'n-pubsub-failure', receiveUser: 'user-1' } as Notification;
    notificationService.create.mockResolvedValue(savedNotification);
    (pubSub.publish as jest.Mock).mockRejectedValueOnce(new Error('subscription unavailable'));

    await eventBus.publish(NOTIFICATION_REQUESTED_EVENT, {
      recipientUserId: 'user-1',
      description: 'Test',
      content: 'Test content',
      type: 'order',
    });

    expect(notificationService.create).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes on module destroy', async () => {
    handler.onModuleDestroy();

    const savedNotification = { id: 'n2' } as Notification;
    notificationService.create.mockResolvedValue(savedNotification);

    await eventBus.publish(NOTIFICATION_REQUESTED_EVENT, {
      recipientUserId: 'user-1',
      description: 'Test',
      content: 'After destroy',
      type: 'order',
    });

    expect(notificationService.create).not.toHaveBeenCalled();
  });
});
