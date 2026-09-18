/**
 * Read model intentionally owned by Orders and consumed by Delivery.
 * It keeps Delivery from receiving a mutable Order entity.
 */
export interface ShipperOrderView {
  id: string;
  status: string;
  total: number | null;
  note: string | null;
  user: { id: string; name: string | null } | null;
  restaurant: { id: string; name: string | null } | null;
  address: {
    street: string | null;
    ward: string | null;
    district: string | null;
    city: string | null;
  } | null;
  orderDetails: Array<{
    id: string;
    quantity: number | null;
    price: string | null;
    food: { id: string; name: string | null } | null;
  }>;
}

export interface DeliveryOrderLifecycleState {
  orderId: string;
  status: string;
}
