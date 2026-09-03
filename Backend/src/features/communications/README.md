# communications

Owner: Conversation, Message, Notification, Chat and messaging orchestration.

## Notification slice (T3.5)

`src/features/communications/notifications/` owns the `Notification` entity, its read/write API and the GraphQL subscription resolver.

Producers (Order, Messenger, etc.) publish `NOTIFICATION_REQUESTED_EVENT` via `InProcessEventBus`. The `NotificationEventHandler` inside this slice subscribes, persists the notification, and pushes to GraphQL PubSub for real-time delivery. Retry (1 attempt) and structured logging are standardised in the handler.

### HTTP API

| Method | Route | Description |
|---|---|---|
| `GET` | `/notifications` | Paginated list of the authenticated user's notifications |
| `PATCH` | `/notifications/:id/read` | Mark a notification as read (ownership-enforced) |

## Event notifications (T8.2)

`NotificationEventHandler` consumes `ordering.order.created`, `payment.succeeded`, `payment.failed` and `delivery.completed` after their source transaction commits. Payment and Delivery resolve the recipient through the Ordering public port.

Persistence uses an event-specific `idempotency_key`; a replay returns the existing notification and does not publish another GraphQL notification. The handler retries once immediately. If both attempts fail, it records a row in `notification_dead_letters`, writes a structured dead-letter log, and does not rethrow into the source domain flow.

### Remaining compatibility

`src/modules/chat` vẫn là compatibility module về vị trí thư mục, nhưng T8.1 đã tách orchestration qua public ports của Catalog, Ordering và Locations. Việc gom module vật lý và xử lý Messenger tiếp tục ở T8.2.
