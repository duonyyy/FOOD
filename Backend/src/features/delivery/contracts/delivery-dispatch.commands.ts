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

/** Aliases using trip dispatch terminology */
export type OfferTripCommand = OfferDeliveryCommand;
export type AcceptTripCommand = AcceptDeliveryCommand;
export type RejectTripCommand = RejectDeliveryCommand;
export type ReassignTripCommand = ReassignDeliveryCommand;
