import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import {
  DELIVERY_ASSIGNMENT_POLICY,
  DeliveryAssignmentPolicy,
} from './contracts/delivery-assignment.policy';

describe('DeliveryAssignmentPolicy', () => {
  it('defines one source of truth for timeout and retry rules', () => {
    expect(DELIVERY_ASSIGNMENT_POLICY.offerHoldTtlSeconds).toBe(120);
    expect(DELIVERY_ASSIGNMENT_POLICY.pendingAssignmentMaxAgeMinutes).toBe(30);
    expect(DELIVERY_ASSIGNMENT_POLICY.pendingAssignmentMaxAttempts).toBe(15);
  });

  it('rejects non-confirmed or already assigned orders', () => {
    expect(() => DeliveryAssignmentPolicy.assertOfferable('pending', false)).toThrow(
      BadRequestException,
    );
    expect(() => DeliveryAssignmentPolicy.assertOfferable('confirmed', true)).toThrow(
      ConflictException,
    );
  });

  it('requires an approved shipper actor', () => {
    expect(() => DeliveryAssignmentPolicy.assertEligible('user', 'APPROVED')).toThrow(
      BadRequestException,
    );
    expect(() => DeliveryAssignmentPolicy.assertEligible('shipper', 'PENDING')).toThrow(
      BadRequestException,
    );
  });

  it('enforces assignment ownership and expiry', () => {
    const assignment = { assignmentId: 'a-1', shipperId: 'shipper-a' };
    expect(() => DeliveryAssignmentPolicy.assertOwnership(assignment, 'a-1', 'shipper-b')).toThrow(
      ForbiddenException,
    );
    expect(() =>
      DeliveryAssignmentPolicy.assertAcceptable(new Date('2020-01-01'), new Date('2020-01-02')),
    ).toThrow(BadRequestException);
  });

  it('allows reassignment only for the assigned shipper or admin', () => {
    expect(() => DeliveryAssignmentPolicy.assertCanReassign('shipper-b', 'shipper-a')).toThrow(
      ForbiddenException,
    );
    expect(() => DeliveryAssignmentPolicy.assertCanReassign('admin-1', 'shipper-a', 'admin')).not.toThrow();
  });
});
