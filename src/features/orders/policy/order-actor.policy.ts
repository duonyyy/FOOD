import { ForbiddenException } from '@nestjs/common';

export interface OrderActorTarget {
  user?: { id: string };
  restaurant?: { owner?: { id: string } };
  shippingDetail?: { shipper?: { id: string } };
}

export class OrderActorPolicy {
  assertCanRead(order: OrderActorTarget, actorId: string): void {
    if (!this.isParticipant(order, actorId)) {
      throw new ForbiddenException('You cannot access this order');
    }
  }

  assertCanDelete(order: OrderActorTarget, actorId: string): void {
    if (order.user?.id !== actorId) {
      throw new ForbiddenException('Only the customer who placed the order can delete it');
    }
  }

  assertCanPay(order: OrderActorTarget, actorId: string): void {
    if (order.user?.id !== actorId) {
      throw new ForbiddenException('Only the customer who placed the order can pay for it');
    }
  }

  assertCanManageRestaurantOrder(order: OrderActorTarget, actorId: string): void {
    if (order.restaurant?.owner?.id !== actorId) {
      throw new ForbiddenException('You can only update orders for your own restaurant');
    }
  }

  private isParticipant(order: OrderActorTarget, actorId: string): boolean {
    return (
      order.user?.id === actorId ||
      order.restaurant?.owner?.id === actorId ||
      order.shippingDetail?.shipper?.id === actorId
    );
  }
}
