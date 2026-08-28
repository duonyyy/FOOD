import { Injectable } from '@nestjs/common';
import { ShipperService } from '../../../modules/shipper/shipper.service';
import {
  AcceptDeliveryCommand,
  OfferDeliveryCommand,
  ReassignDeliveryCommand,
  RejectDeliveryCommand,
} from '../contracts/delivery-assignment.commands';
import { DeliveryAssignmentPolicy } from '../contracts/delivery-assignment.policy';

/** Delivery application commands; ShipperService is the temporary legacy adapter. */
@Injectable()
export class DeliveryAssignmentCommandService {
  constructor(private readonly legacyAssignmentService: ShipperService) {}

  async offerDelivery(command: OfferDeliveryCommand) {
    DeliveryAssignmentPolicy.assertCommandActor(command.actorId);
    DeliveryAssignmentPolicy.assertOrderId(command.orderId);
    return this.legacyAssignmentService.requestOrderAssignment(command.orderId, command.actorId);
  }

  async acceptDelivery(command: AcceptDeliveryCommand) {
    DeliveryAssignmentPolicy.assertCommandActor(command.actorId);
    const assignment = await this.legacyAssignmentService.getPendingAssignmentForShipper(
      command.actorId,
    );
    if (!assignment) {
      DeliveryAssignmentPolicy.assertOwnership(assignment, command.assignmentId, command.actorId);
      return null;
    }
    DeliveryAssignmentPolicy.assertOwnership(assignment, command.assignmentId, command.actorId);
    DeliveryAssignmentPolicy.assertAcceptable(new Date(assignment.expiresAt));
    return this.legacyAssignmentService.acceptAssignment(command.assignmentId, command.actorId);
  }

  async rejectDelivery(command: RejectDeliveryCommand) {
    DeliveryAssignmentPolicy.assertCommandActor(command.actorId);
    const assignment = await this.legacyAssignmentService.getPendingAssignmentForShipper(
      command.actorId,
    );
    if (!assignment) {
      DeliveryAssignmentPolicy.assertOwnership(assignment, command.assignmentId, command.actorId);
      return null;
    }
    DeliveryAssignmentPolicy.assertOwnership(assignment, command.assignmentId, command.actorId);
    return this.legacyAssignmentService.rejectAssignment(command.assignmentId, command.actorId);
  }

  async reassignDelivery(command: ReassignDeliveryCommand) {
    DeliveryAssignmentPolicy.assertCommandActor(command.actorId);
    const assignment = await this.legacyAssignmentService.getPendingAssignmentForOrder(
      command.orderId,
    );
    DeliveryAssignmentPolicy.assertCanReassign(
      command.actorId,
      assignment?.shipperId ?? null,
      command.actorRole,
    );
    return this.legacyAssignmentService.reassignOrder(command.orderId);
  }
}
