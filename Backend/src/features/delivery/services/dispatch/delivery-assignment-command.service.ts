import { Injectable } from '@nestjs/common';
import {
  AcceptDeliveryCommand,
  OfferDeliveryCommand,
  ReassignDeliveryCommand,
  RejectDeliveryCommand,
} from '../../contracts/delivery-dispatch.commands';
import { DeliveryDispatchPolicy } from '../../contracts/delivery-dispatch.policy';
import { ShipperService } from '../shipper/shipper.service';

/** Backward compatibility command adapter for legacy callers and unit tests */
@Injectable()
export class DeliveryAssignmentCommandService {
  constructor(private readonly legacyAssignmentService: ShipperService) {}

  async offerDelivery(command: OfferDeliveryCommand) {
    DeliveryDispatchPolicy.assertCommandActor(command.actorId);
    DeliveryDispatchPolicy.assertOrderId(command.orderId);
    return this.legacyAssignmentService.requestOrderAssignment(command.orderId, command.actorId);
  }

  async acceptDelivery(command: AcceptDeliveryCommand) {
    DeliveryDispatchPolicy.assertCommandActor(command.actorId);
    const assignment = await this.legacyAssignmentService.getPendingAssignmentForShipper(
      command.actorId,
    );
    if (!assignment) {
      DeliveryDispatchPolicy.assertOwnership(assignment, command.assignmentId, command.actorId);
      return null;
    }
    DeliveryDispatchPolicy.assertOwnership(assignment, command.assignmentId, command.actorId);
    DeliveryDispatchPolicy.assertAcceptable(new Date(assignment.expiresAt));
    return this.legacyAssignmentService.acceptAssignment(command.assignmentId, command.actorId);
  }

  async rejectDelivery(command: RejectDeliveryCommand) {
    DeliveryDispatchPolicy.assertCommandActor(command.actorId);
    const assignment = await this.legacyAssignmentService.getPendingAssignmentForShipper(
      command.actorId,
    );
    if (!assignment) {
      DeliveryDispatchPolicy.assertOwnership(assignment, command.assignmentId, command.actorId);
      return null;
    }
    DeliveryDispatchPolicy.assertOwnership(assignment, command.assignmentId, command.actorId);
    return this.legacyAssignmentService.rejectAssignment(command.assignmentId, command.actorId);
  }

  async reassignDelivery(command: ReassignDeliveryCommand) {
    DeliveryDispatchPolicy.assertCommandActor(command.actorId);
    const assignment = await this.legacyAssignmentService.getPendingAssignmentForOrder(
      command.orderId,
    );
    DeliveryDispatchPolicy.assertCanReassign(
      command.actorId,
      assignment?.shipperId ?? null,
      command.actorRole,
    );
    return this.legacyAssignmentService.reassignOrder(command.orderId);
  }
}
