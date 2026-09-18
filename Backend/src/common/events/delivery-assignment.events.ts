export const DELIVERY_ASSIGNMENT_REQUESTED_EVENT = 'delivery.assignment-requested';
export const DELIVERY_ASSIGNMENT_CLAIMED_EVENT = 'delivery.assignment-claimed';
export const DELIVERY_ASSIGNMENT_REJECTED_EVENT = 'delivery.assignment-rejected';

export type DeliveryAssignmentRequestedEvent = Record<string, unknown> & {
  orderId: string;
  shipperId: string;
  shippingDetailId: string;
};

export type DeliveryAssignmentClaimedEvent = DeliveryAssignmentRequestedEvent;

export type DeliveryAssignmentRejectedEvent = DeliveryAssignmentRequestedEvent & {
  orderStatus: string;
};
