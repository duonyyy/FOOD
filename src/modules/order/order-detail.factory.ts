import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Order } from 'src/entities/order.entity';
import { OrderDetail } from 'src/entities/orderDetail.entity';
import { ValidatedOrderDetail } from './dto/order-calculation.types';

@Injectable()
export class OrderDetailFactory {
  async createMany(
    order: Order,
    foodDetails: ValidatedOrderDetail[],
    manager: EntityManager,
  ): Promise<void> {
    const orderDetails = foodDetails.map((detail) => {
      const orderDetail = new OrderDetail();
      orderDetail.order = order;
      orderDetail.food = detail.food;
      orderDetail.quantity = detail.quantity;
      // Persist the discounted unit price; toppings remain in their own JSON/total columns.
      orderDetail.price = String(detail.discountedPrice);
      orderDetail.selectedToppings = detail.selectedToppings || [];
      orderDetail.toppingTotal = detail.toppingTotal;
      return orderDetail;
    });

    await manager.save(OrderDetail, orderDetails);
  }
}
