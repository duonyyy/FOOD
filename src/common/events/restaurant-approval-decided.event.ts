import { RestaurantStatus } from 'src/entities/restaurant.entity';
import { RestaurantApprovalAction } from 'src/entities/restaurantApprovalAudit.entity';

export const RESTAURANT_APPROVAL_DECIDED_EVENT = 'restaurant.approval.decided';

export interface RestaurantApprovalDecidedEvent {
  auditId: string;
  restaurantId: string;
  actorUserId: string;
  action: RestaurantApprovalAction;
  reason: string | null;
  previousStatus: RestaurantStatus;
  nextStatus: RestaurantStatus;
  occurredAt: Date;
}
