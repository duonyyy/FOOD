import { TypeOrmModule } from '@nestjs/typeorm';
import { PendingShipperAssignment } from '../../entities/pendingShipperAssignment.entity';
import { ShipperCertificateInfo } from '../../entities/shipperCertificateInfo.entity';
import { ShipperProfile } from '../../entities/shipperProfile.entity';
import { ShippingDetail } from '../../entities/shippingDetail.entity';
import { SHIPPER_PROFILE_COMMANDS, SHIPPER_PROFILE_READER } from './contracts/shipper-profile.port';
import { DeliveryModule } from './delivery.module';
import { ShipperProfileModule } from './shipper-profile.module';

describe('Delivery ownership boundary', () => {
  it('registers delivery persistence under DeliveryModule', () => {
    const metadata = Reflect.getMetadata('imports', DeliveryModule) as unknown[];
    const typeOrmImport = metadata.find(isTypeOrmImport);

    expect(typeOrmImport?.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetEntitySchema: expect.objectContaining({
            target: PendingShipperAssignment,
          }) as unknown,
        }),
        expect.objectContaining({
          targetEntitySchema: expect.objectContaining({ target: ShippingDetail }) as unknown,
        }),
        expect.objectContaining({
          targetEntitySchema: expect.objectContaining({
            target: ShipperCertificateInfo,
          }) as unknown,
        }),
      ]),
    );
  });

  it('exports a profile read contract', () => {
    expect(Reflect.getMetadata('imports', DeliveryModule)).toContain(ShipperProfileModule);
    expect(Reflect.getMetadata('exports', ShipperProfileModule)).toEqual(
      expect.arrayContaining([SHIPPER_PROFILE_READER, SHIPPER_PROFILE_COMMANDS]),
    );
  });

  it('registers the profile repository inside the Delivery profile module', () => {
    const metadata = Reflect.getMetadata('imports', ShipperProfileModule) as unknown[];
    const typeOrmImport = metadata.find(isTypeOrmImport);

    expect(typeOrmImport?.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetEntitySchema: expect.objectContaining({ target: ShipperProfile }) as unknown,
        }),
      ]),
    );
  });
});

interface TypeOrmImportMetadata {
  module: unknown;
  providers?: unknown[];
}

function isTypeOrmImport(value: unknown): value is TypeOrmImportMetadata {
  return (
    typeof value === 'object' &&
    value !== null &&
    'module' in value &&
    value.module === TypeOrmModule &&
    (!('providers' in value) || Array.isArray(value.providers))
  );
}
