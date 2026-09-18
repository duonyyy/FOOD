import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { haversineDistance } from 'src/common/utils/geo.util';
import { ShippingDetail, ShippingStatus } from 'src/entities/shippingDetail.entity';
import { Repository } from 'typeorm';
import type {
  DeliveryQuoteRequest,
  DeliveryQuote,
} from '../../types/delivery-integration.types';

/**
 * Delivery integration service used by Orders and Customer app through the Delivery public API.
 */
@Injectable()
export class DeliveryIntegrationService {
  constructor(
    @InjectRepository(ShippingDetail)
    private readonly shippingDetailRepository: Repository<ShippingDetail>,
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

  async getDeliveryTracking(orderId: string) {
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
}
