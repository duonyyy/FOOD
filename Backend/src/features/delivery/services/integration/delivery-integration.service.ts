import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { haversineDistance } from 'src/common/utils/geo.util';
import { Order } from 'src/entities/order.entity';
import { ShippingDetail } from 'src/entities/shippingDetail.entity';
import { Repository } from 'typeorm';
import type {
  DeliveryOrderSnapshot,
  DeliveryQuoteRequest,
  DeliveryQuoteSnapshot,
} from '../../types/delivery-integration.types';

/**
 * Delivery integration service used by Orders and Customer app through the Delivery public API.
 */
@Injectable()
export class DeliveryIntegrationService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(ShippingDetail)
    private readonly shippingDetailRepository: Repository<ShippingDetail>,
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

  async quoteDelivery(request: DeliveryQuoteRequest): Promise<DeliveryQuoteSnapshot> {
    const distanceKm = haversineDistance(
      request.origin.latitude,
      request.origin.longitude,
      request.destination.latitude,
      request.destination.longitude,
    );

    const baseFee = 15000;
    const extraPerKm = 5000;
    const deliveryFee = Math.round(baseFee + Math.max(0, distanceKm - 2) * extraPerKm);
    const estimatedMinutes = Math.round(15 + distanceKm * 4);

    return {
      distanceKilometers: Math.round(distanceKm * 10) / 10,
      estimatedMinutes,
      deliveryFee,
    };
  }

  async getDeliveryTracking(orderId: string) {
    const shippingDetail = await this.shippingDetailRepository.findOne({
      where: { order: { id: orderId } },
      relations: ['order', 'shipper'],
    });

    if (!shippingDetail) {
      const order = await this.orderRepository.findOne({ where: { id: orderId } });
      if (!order) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }
      return {
        orderId: order.id,
        status: order.status,
        trackingStatus: 'PENDING_SHIPPER',
        estimatedDeliveryTime: null,
        shipper: null,
      };
    }

    return {
      orderId: shippingDetail.order?.id ?? orderId,
      status: shippingDetail.order?.status ?? 'delivering',
      trackingStatus: shippingDetail.status,
      estimatedDeliveryTime: shippingDetail.estimatedDeliveryTime,
      actualDeliveryTime: shippingDetail.actualDeliveryTime,
      shipper: shippingDetail.shipper
        ? {
            id: shippingDetail.shipper.id,
            name: shippingDetail.shipper.name,
            phone: shippingDetail.shipper.phone,
            rating: shippingDetail.shipper.averageRating,
          }
        : null,
    };
  }
}
