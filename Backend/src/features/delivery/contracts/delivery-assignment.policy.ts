import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

export const DELIVERY_ASSIGNMENT_POLICY = Object.freeze({
  offerHoldTtlSeconds: 2 * 60,
  pendingAssignmentTtlSeconds: 48 * 60 * 60,
  pendingAssignmentMaxAgeMinutes: 30,
  pendingAssignmentMaxAttempts: 15,
  retryMaxAttempts: 10,
});

export interface AssignmentOwnership {
  assignmentId: string;
  shipperId: string | null;
}

export class DeliveryAssignmentPolicy {
  static assertOrderId(orderId: string): void {
    if (!orderId?.trim()) {
      throw new BadRequestException('Order ID is required');
    }
  }

  static assertCommandActor(actorId: string): void {
    if (!actorId?.trim()) {
      throw new BadRequestException('Actor ID is required');
    }
  }

  static assertOfferable(orderStatus: string, hasShippingDetail: boolean): void {
    if (orderStatus !== 'confirmed') {
      throw new BadRequestException('Order must be confirmed to assign to shipper');
    }
    if (hasShippingDetail) {
      throw new ConflictException('Order already assigned to a shipper');
    }
  }

  static assertEligible(actorRole: string | undefined, certificateStatus: string | undefined): void {
    if (actorRole !== 'shipper' || certificateStatus !== 'APPROVED') {
      throw new BadRequestException('Invalid or unapproved shipper');
    }
  }

  static assertOwnership(
    assignment: AssignmentOwnership | null,
    assignmentId: string,
    actorId: string,
  ): void {
    if (!assignment || assignment.assignmentId !== assignmentId) {
      throw new BadRequestException('Assignment not found or already processed');
    }
    if (assignment.shipperId !== actorId) {
      throw new ForbiddenException('This assignment does not belong to you');
    }
  }

  static assertAcceptable(expiresAt: Date, now = new Date()): void {
    if (expiresAt.getTime() <= now.getTime()) {
      throw new BadRequestException('Assignment has expired');
    }
  }

  static assertCanReassign(actorId: string, targetShipperId: string | null, actorRole?: string): void {
    const isAdmin = ['admin', 'administrator', 'super_admin'].includes(actorRole ?? '');
    if (!isAdmin && (!targetShipperId || actorId !== targetShipperId)) {
      throw new ForbiddenException('Only the assigned shipper or an admin can reassign');
    }
  }
}
