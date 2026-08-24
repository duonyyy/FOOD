import { Module } from '@nestjs/common';
import { ShipperModule } from '../../modules/shipper/shipper.module';

/** Compatibility shell for shipper and delivery-assignment ownership. */
@Module({ imports: [ShipperModule] })
export class DeliveryModule {}
