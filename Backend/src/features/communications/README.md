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

### Remaining compatibility

`src/modules/chat` and `src/modules/messenger` remain as compatibility modules until T8.1–T8.2 migrate them into this feature.
