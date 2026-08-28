import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type DeliveryOrderReaderPort,
  type DeliveryOrderSnapshot,
} from 'src/features/delivery/contracts/delivery-order-reader.port';
import { Repository } from 'typeorm';
import { Order } from '../../entities/order.entity';

/** Legacy Ordering adapter exposed to Delivery through a read-only feature contract. */
@Injectable()
export class DeliveryOrderReaderAdapter implements DeliveryOrderReaderPort {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async findOrderForDeliveryAssignment(orderId: string): Promise<DeliveryOrderSnapshot | null> {
    return this.orderRepository.findOne({
      where: { id: orderId },
      relations: [
        'restaurant',
        'user',
        'address',
        'orderDetails',
        'orderDetails.food',
        'shippingDetail',
      ],
    });
  }
}
