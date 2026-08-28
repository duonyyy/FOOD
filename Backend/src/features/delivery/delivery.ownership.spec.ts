import { TypeOrmModule } from '@nestjs/typeorm';
import { PendingShipperAssignment } from '../../entities/pendingShipperAssignment.entity';
import { ShipperCertificateInfo } from '../../entities/shipperCertificateInfo.entity';
import { ShipperProfile } from '../../entities/shipperProfile.entity';
import { ShippingDetail } from '../../entities/shippingDetail.entity';
import { SHIPPER_PROFILE_READER } from './contracts/shipper-profile.port';
import { DeliveryModule } from './delivery.module';

describe('Delivery ownership boundary', () => {
  it('registers delivery persistence under DeliveryModule', () => {
    const metadata = Reflect.getMetadata('imports', DeliveryModule) as unknown[];
    const typeOrmImport = metadata.find(
      (item: any) => item?.module === TypeOrmModule,
    ) as any;

    expect(typeOrmImport?.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetEntitySchema: expect.objectContaining({ target: PendingShipperAssignment }),
        }),
        expect.objectContaining({
          targetEntitySchema: expect.objectContaining({ target: ShippingDetail }),
        }),
        expect.objectContaining({
          targetEntitySchema: expect.objectContaining({ target: ShipperProfile }),
        }),
        expect.objectContaining({
          targetEntitySchema: expect.objectContaining({ target: ShipperCertificateInfo }),
        }),
      ]),
    );
  });

  it('exports a profile read contract', () => {
    expect(Reflect.getMetadata('exports', DeliveryModule)).toContain(
      SHIPPER_PROFILE_READER,
    );
  });
});
