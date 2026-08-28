export interface OfferDeliveryCommand {
  orderId: string;
  actorId: string;
}

export interface AcceptDeliveryCommand {
  assignmentId: string;
  actorId: string;
}

export interface RejectDeliveryCommand {
  assignmentId: string;
  actorId: string;
}

export interface ReassignDeliveryCommand {
  orderId: string;
  actorId: string;
  actorRole?: string;
}
