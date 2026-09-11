import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ShippingDetail, ShippingStatus } from 'src/entities/shippingDetail.entity';
import { Repository } from 'typeorm';

/** Authorizes access to a live driver location only while a delivery is active. */
@Injectable()
export class DeliverySubscriptionAccessService {
  constructor(
    @InjectRepository(ShippingDetail)
    private readonly shippingDetailRepository: Repository<ShippingDetail>,
  ) {}

  async canAccessShipperLocation(actorId: string, shipperId: string): Promise<boolean> {
    if (!actorId || !shipperId) {
      return false;
    }

    if (actorId === shipperId) {
      return true;
    }

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
