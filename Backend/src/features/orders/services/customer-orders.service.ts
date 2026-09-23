import { Injectable } from '@nestjs/common';
import { AddressService } from 'src/features/locations/public-api';
import { PaymentService } from 'src/features/payments/public-api';
import { CreateOrderDto } from '../dto/create-order.dto';
import { PaymentDto } from '../dto/payment.dto';
import { OrderCreationService } from './order-creation.service';

/** Customer-facing Orders use cases. */
@Injectable()
export class CustomerOrdersService {
  constructor(
    private readonly orderCreation: OrderCreationService,
    private readonly addresses: AddressService,
    private readonly payments: PaymentService,
  ) {}

  createTemporaryAddress(
    address: {
      street: string;
      ward: string;
      district: string;
      city: string;
      latitude: number;
      longitude: number;
      label?: string;
    },
    userId: string,
  ): Promise<string> {
    return this.addresses
      .createTemporaryAddress(address, userId)
      .then(({ addressId }) => addressId);
  }

  deleteTemporaryAddress(addressId: string): Promise<void> {
    return this.addresses.removeTemporaryAddress(addressId);
  }

  createOrder(data: CreateOrderDto) {
    return this.orderCreation.createOrder(data);
  }

  getOrdersByUser(userId: string, page = 1, pageSize = 10, status?: string) {
    return this.orderCreation.getOrdersByUser(userId, page, pageSize, status);
  }

  getMinimalOrderHistoryForQuickReorder(userId: string, limit = 3) {
    return this.orderCreation.getMinimalOrderHistoryForQuickReorder(userId, limit);
  }

  getOrderHistory(userId: string, page = 1, pageSize = 10) {
    return this.orderCreation.getOrderHistory(userId, page, pageSize);
  }

  deleteOrder(orderId: string) {
    return this.orderCreation.deleteOrder(orderId);
  }

  processPayment(orderId: string, customerId: string, paymentData: PaymentDto) {
    return this.payments.processPaymentForOrder(orderId, customerId, { ...paymentData });
  }
}
