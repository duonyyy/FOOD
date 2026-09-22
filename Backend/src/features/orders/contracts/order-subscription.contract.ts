import type { ReturnTypeFunc } from '@nestjs/graphql';
import { Order } from 'src/entities/order.entity';

/** Keeps the GraphQL Order type owned by Orders without exposing its entity to Delivery. */
export const orderSubscriptionGraphqlType: ReturnTypeFunc = () => Order;

export interface ShipperOrderSubscriptionPayload {
  orderConfirmedForShippers: {
    status: string;
    shippingDetail?: unknown;
    shippingFee?: number;
    shipperEarnings?: number;
    shipperCommissionRate?: number;
    deliveryDistance?: number;
    estimatedDeliveryTime?: number;
    [key: string]: unknown;
  };
  targetShipperId: string;
  distanceKm?: number;
  priorityScore?: number;
}
