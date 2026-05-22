import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Address } from 'src/entities/address.entity';
import { Checkout, CheckoutStatus } from 'src/entities/checkout.entity';
import { Order } from 'src/entities/order.entity';
import { PendingAssignmentService } from 'src/queue/pending-assignment.service';
import { OrderEventService } from './order-event.service';

@Injectable()
export class OrderSchedulerService {
  private readonly logger = new Logger(OrderSchedulerService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Checkout)
    private readonly checkoutRepository: Repository<Checkout>,
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
    private readonly pendingAssignmentService: PendingAssignmentService,
    private readonly orderEventService: OrderEventService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoCancelStuckOrders(): Promise<void> {
    const timeoutMinutes = 15;
    const timeoutDate = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    const stuckOrders = await this.orderRepository.find({
      where: {
        status: 'processing_payment',
        createdAt: LessThan(timeoutDate),
      },
    });

    if (stuckOrders.length) {
      this.logger.log(`Auto-canceling ${stuckOrders.length} stuck orders...`);
    }

    for (const order of stuckOrders) {
      order.status = 'canceled';
      await this.orderRepository.save(order);

      const checkout = await this.checkoutRepository.findOne({
        where: { orderId: order.id },
      });
      if (
        checkout &&
        checkout.status !== CheckoutStatus.COMPLETED &&
        checkout.status !== CheckoutStatus.CANCELLED
      ) {
        checkout.status = CheckoutStatus.CANCELLED;
        await this.checkoutRepository.save(checkout);
      }

      this.logger.log(
        `Order ${order.id} auto-canceled due to payment timeout.`,
      );
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoCancelUnassignedOrders(): Promise<void> {
    const timeoutMinutes = 30;
    const timeoutDate = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    this.logger.log(
      `Checking for pending assignments older than ${timeoutMinutes} minutes...`,
    );
    const expiredAssignments =
      await this.pendingAssignmentService.getExpiredAssignments(timeoutDate);

    if (expiredAssignments.length > 0) {
      this.logger.log(
        `Found ${expiredAssignments.length} expired assignments to cancel`,
      );
    }

    for (const assignment of expiredAssignments) {
      try {
        const order = assignment.order;

        if (order.status !== 'confirmed') {
          this.logger.log(
            `Skipping order ${order.id} - status already changed to ${order.status}`,
          );
          continue;
        }

        const currentOrder = await this.orderRepository.findOne({
          where: { id: order.id },
          relations: ['shippingDetail'],
        });

        if (currentOrder?.shippingDetail) {
          this.logger.log(
            `Skipping order ${order.id} - already assigned to shipper`,
          );
          await this.pendingAssignmentService.removePendingAssignment(order.id);
          continue;
        }

        order.status = 'canceled';
        await this.orderRepository.save(order);
        await this.pendingAssignmentService.removePendingAssignmentById(
          assignment.id,
        );
        await this.orderEventService.publishOrderStatusUpdated(order);

        const pendingDuration = Math.round(
          (Date.now() - assignment.createdAt.getTime()) / (1000 * 60),
        );
        this.logger.log(
          `Auto-canceled order ${order.id} (${order.restaurant?.name}) - pending for ${pendingDuration} minutes without shipper`,
        );

        await this.orderEventService.notifyOrderCancellation(
          order,
          'No delivery driver available in your area',
        );
      } catch (error) {
        this.logger.error(
          `Failed to auto-cancel order ${assignment.order.id}: ${error.message}`,
          error.stack,
        );
      }
    }

    if (expiredAssignments.length > 0) {
      this.logger.log(
        `Auto-cancellation completed: ${expiredAssignments.length} orders canceled`,
      );
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupTemporaryAddresses(): Promise<void> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      const result = await this.addressRepository.delete({
        isTemporary: true,
        createdAt: LessThan(oneDayAgo),
      });

      if (result.affected && result.affected > 0) {
        this.logger.log(
          `Cleaned up ${result.affected} temporary addresses older than 24 hours`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to cleanup temporary addresses: ${error.message}`,
        error.stack,
      );
    }
  }
}
