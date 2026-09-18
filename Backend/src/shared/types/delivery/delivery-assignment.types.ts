export interface DeliveryAssignmentJobData {
  readonly pendingAssignmentId: string;
  readonly orderId: string;
  readonly attempt: number;
  readonly isRetry?: boolean;
  readonly originalJobId?: string;
  readonly retryAttempt?: number;
}

export interface PendingAssignmentState {
  id: string;
  orderId: string;
  priority: number;
  attemptCount: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string;
  createdAt: string;
  notes: string | null;
  isSentToShipper: boolean;
  targetShipperId: string | null;
}

export interface ShipperAssignmentHold {
  assignmentId: string;
  orderId: string;
  shipperId: string;
  expiresAt: string;
}
