import { Injectable } from '@nestjs/common';
import { Order } from 'src/entities/order.entity';
import { CreateOrderDto } from '../dto/create-order.dto';
import { PaymentDto } from '../dto/payment.dto';
import type { OrderAnalyticsPage, OrderAnalyticsSnapshot } from '../types/order-analytics.types';
import type {
  AssertCustomerCanChatWithShipperRequest,
  CustomerShipperChatPartner,
} from '../types/order-messaging.types';
import { AdminOrdersService } from './admin-orders.service';
import { CustomerOrdersService } from './customer-orders.service';
import { MerchantOrdersService } from './merchant-orders.service';
import { OrderCoreService } from './order-core.service';

/**
 * Unified Facade for Orders.
 * Delegates role-specific responsibilities to CustomerOrdersService,
 * MerchantOrdersService, AdminOrdersService, and OrderCoreService.
 */
@Injectable()
export class OrderService {
  constructor(
    private readonly customerOrdersService: CustomerOrdersService,
    private readonly merchantOrdersService: MerchantOrdersService,
    private readonly adminOrdersService: AdminOrdersService,
    private readonly orderCoreService: OrderCoreService,
  ) {}

  // ==========================================
  // CUSTOMER OPERATIONS
  // ==========================================

  createTemporaryAddress(
    addressData: {
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
    return this.customerOrdersService.createTemporaryAddress(addressData, userId);
  }

  deleteTemporaryAddress(addressId: string): Promise<void> {
    return this.customerOrdersService.deleteTemporaryAddress(addressId);
  }

  calculateOrder(data: {
    addressId: string;
    restaurantId: string;
    items: {
      foodId: string;
      quantity: number;
      discountPercent?: number;
      toppings?: { id: string; price: number }[];
    }[];
    promotionCode?: string;
  }) {
    return this.customerOrdersService.calculateOrder(data);
  }

  calculateOrderWithCustomAddress(
    address: {
      street: string;
      ward: string;
      district: string;
      city: string;
      latitude: number;
      longitude: number;
      label?: string;
    },
    restaurantId: string,
    items: {
      foodId: string;
      quantity: number;
      discountPercent?: number;
      toppings?: { id: string; price: number }[];
    }[],
    promotionCode?: string,
  ) {
    return this.customerOrdersService.calculateOrderWithCustomAddress(
      address,
      restaurantId,
      items,
      promotionCode,
    );
  }

  validatePromotionForOrder(
    promotionCode: string,
    addressId: string,
    restaurantId: string,
    items: { foodId: string; quantity: number }[],
  ) {
    return this.customerOrdersService.validatePromotionForOrder(
      promotionCode,
      addressId,
      restaurantId,
      items,
    );
  }

  createOrder(data: CreateOrderDto) {
    return this.customerOrdersService.createOrder(data);
  }

  getOrdersByUser(userId: string, page: number = 1, pageSize: number = 10, status?: string) {
    return this.customerOrdersService.getOrdersByUser(userId, page, pageSize, status);
  }

  getMinimalOrderHistoryForQuickReorder(userId: string, limit = 3) {
    return this.customerOrdersService.getMinimalOrderHistoryForQuickReorder(userId, limit);
  }

  getOrderHistory(userId: string, page: number = 1, pageSize: number = 10) {
    return this.customerOrdersService.getOrderHistory(userId, page, pageSize);
  }

  deleteOrder(id: string) {
    return this.customerOrdersService.deleteOrder(id);
  }

  processPayment(orderId: string, paymentData: PaymentDto) {
    return this.customerOrdersService.processPayment(orderId, paymentData);
  }

  // ==========================================
  // MERCHANT OPERATIONS
  // ==========================================

  getOrdersByRestaurant(
    restaurantId: string,
    page: number = 1,
    pageSize: number = 10,
    status?: string,
  ) {
    return this.merchantOrdersService.getOrdersByRestaurant(restaurantId, page, pageSize, status);
  }

  confirmOrder(orderId: string, restaurantOwnerId: string): Promise<Order> {
    return this.merchantOrdersService.confirmOrder(orderId, restaurantOwnerId);
  }

  updateOrderStatus(id: string, status: string): Promise<Order> {
    return this.merchantOrdersService.updateOrderStatus(id, status);
  }

  // ==========================================
  // ADMIN & OPERATIONAL
  // ==========================================

  getAllOrders() {
    return this.adminOrdersService.getAllOrders();
  }

  adminUpdateOrderStatus(id: string, status: string): Promise<Order> {
    return this.adminOrdersService.adminUpdateOrderStatus(id, status);
  }

  confirmPayment(orderId: string): Promise<Order> {
    return this.adminOrdersService.markPaid(orderId);
  }

  autoCancelStuckOrders() {
    return this.adminOrdersService.autoCancelStuckOrders();
  }

  // ==========================================
  // CORE QUERIES & ANALYTICS
  // ==========================================

  getOrderById(id: string, includeReviewInfo: boolean = false): Promise<Order> {
    return this.orderCoreService.getOrderById(id, includeReviewInfo);
  }

  getOrderByIdWithReviews(id: string) {
    return this.orderCoreService.getOrderById(id, true);
  }

  getOrderDetails(orderId: string) {
    return this.orderCoreService.getOrderDetails(orderId);
  }

  getAnalyticsSnapshot(orderId: string): Promise<OrderAnalyticsSnapshot> {
    return this.orderCoreService.getAnalyticsSnapshot(orderId);
  }

  getAnalyticsSnapshots(page: number, pageSize: number): Promise<OrderAnalyticsPage> {
    return this.orderCoreService.getAnalyticsSnapshots(page, pageSize);
  }

  assertCustomerCanChatWithShipper(
    request: AssertCustomerCanChatWithShipperRequest,
  ): Promise<void> {
    return this.orderCoreService.assertCustomerCanChatWithShipper(request);
  }

  listCustomerShipperChatPartners(customerId: string): Promise<CustomerShipperChatPartner[]> {
    return this.orderCoreService.listCustomerShipperChatPartners(customerId);
  }

  isOrderOpenForShipperMessaging(orderId: string): Promise<boolean> {
    return this.orderCoreService.isOrderOpenForShipperMessaging(orderId);
  }
}
