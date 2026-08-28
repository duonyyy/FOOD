export const PENDING_ASSIGNMENT_STORE = Symbol('PENDING_ASSIGNMENT_STORE');

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

export interface PendingAssignmentStorePort {
  createOrGet(orderId: string, priority: number): Promise<PendingAssignmentState>;
  save(assignment: PendingAssignmentState): Promise<void>;
  getById(assignmentId: string): Promise<PendingAssignmentState | null>;
  getByOrderId(orderId: string): Promise<PendingAssignmentState | null>;
  getDueAssignments(limit: number): Promise<PendingAssignmentState[]>;
  acquireProcessingLock(assignmentId: string, ttlSeconds?: number): Promise<boolean>;
  removeDue(assignmentId: string): Promise<void>;
  remove(assignment: PendingAssignmentState): Promise<void>;
  removeByOrderId(orderId: string): Promise<boolean>;
  getExpiredAssignments(cutoffDate: Date): Promise<PendingAssignmentState[]>;
  count(): Promise<number>;
  countReady(): Promise<number>;
  markShipperNotified(assignment: PendingAssignmentState, shipperId: string): Promise<void>;
  addNotifiedShipper(orderId: string, shipperId: string): Promise<void>;
  getNotifiedShippers(orderId: string): Promise<string[]>;
  getHoldForShipper(shipperId: string): Promise<ShipperAssignmentHold | null>;
  getHoldForOrder(orderId: string): Promise<ShipperAssignmentHold | null>;
  clearHoldForShipper(shipperId: string): Promise<void>;
  getExcludedShipperIds(orderId: string): Promise<string[]>;
}
