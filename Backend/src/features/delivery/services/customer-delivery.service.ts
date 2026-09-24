import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { haversineDistance } from 'src/common/utils/geo.util';
import { ShippingDetail, ShippingStatus } from 'src/entities/shippingDetail.entity';
import { OrderDeliveryService } from 'src/features/orders/public-api';
import { Repository } from 'typeorm';
import type { DeliveryQuote, DeliveryQuoteRequest } from '../types/delivery-integration.types';

/** Customer-facing quote, tracking and live-location access policy. */
@Injectable()
export class CustomerDeliveryService {
  constructor(
    @InjectRepository(ShippingDetail)
    private readonly shippingDetailRepository: Repository<ShippingDetail>,
    private readonly orderDelivery: OrderDeliveryService,
  ) {}

  async quoteDelivery(request: DeliveryQuoteRequest): Promise<DeliveryQuote> {
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

  async getDeliveryTracking(orderId: string, customerId: string) {
    await this.orderDelivery.assertCustomerCanTrackOrder(orderId, customerId);
    const shippingDetail = await this.shippingDetailRepository.findOne({
      where: { order: { id: orderId } },
      relations: ['shipper'],
    });

    if (!shippingDetail) {
      return {
        orderId,
        status: 'confirmed',
        trackingStatus: 'PENDING_SHIPPER',
        estimatedDeliveryTime: null,
        shipper: null,
      };
    }

    return {
      orderId,
      status: shippingDetail.status === ShippingStatus.COMPLETED ? 'completed' : 'delivering',
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

  async canAccessShipperLocation(actorId: string, shipperId: string): Promise<boolean> {
    if (!actorId || !shipperId) return false;
    if (actorId === shipperId) return true;

    const activeDelivery = await this.shippingDetailRepository.findOne({
      where: {
        shipper: { id: shipperId },
        order: { user: { id: actorId } },
        status: ShippingStatus.SHIPPING,
      },
    });
    return Boolean(activeDelivery);
  }
}
