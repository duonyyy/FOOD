import { TypeOrmModule } from '@nestjs/typeorm';
import { PendingShipperAssignment } from 'src/entities/pendingShipperAssignment.entity';
import { ShipperCertificateInfo } from 'src/entities/shipperCertificateInfo.entity';
import { ShipperProfile } from 'src/entities/shipperProfile.entity';
import { ShippingDetail } from 'src/entities/shippingDetail.entity';
import { AuthModule } from 'src/features/auth/auth.module';
import { DeliveryModule } from 'src/features/delivery/delivery.module';
import { FindShipperProcessor } from 'src/features/delivery/queue/find-shipper.processor';
import { DeliveryDispatchService } from 'src/features/delivery/services/delivery-dispatch.service';
import {
  ShipperProfileModule,
  ShipperProfileService,
} from 'src/features/delivery/shipper-profile.public-api';
import { OrdersModule } from 'src/features/orders/public-api';
import { UsersModule } from 'src/features/users/identity-auth.public-api';
import { WorkerModule } from 'src/worker.module';

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

  it('exports the concrete profile service from the narrow profile module', () => {
    expect(Reflect.getMetadata('imports', DeliveryModule)).toContain(ShipperProfileModule);
    expect(Reflect.getMetadata('exports', ShipperProfileModule)).toEqual(
      expect.arrayContaining([ShipperProfileService]),
    );
  });

  it('keeps Auth pointing only to the narrow profile module with no reverse Auth import', () => {
    expect(Reflect.getMetadata('imports', AuthModule)).toContain(ShipperProfileModule);
    const profileImports = Reflect.getMetadata('imports', ShipperProfileModule) as unknown[];
    expect(profileImports).toContain(UsersModule);
    expect(profileImports).not.toContain(AuthModule);
    expect(profileImports).not.toContain(DeliveryModule);
    expect(Reflect.getMetadata('exports', ShipperProfileModule)).toEqual([ShipperProfileService]);
  });

  it('imports Orders through its single public module', () => {
    expect(Reflect.getMetadata('imports', DeliveryModule)).toContain(OrdersModule);
  });

  it('registers exactly one worker processor and exports dispatch when needed', () => {
    expect(Reflect.getMetadata('imports', WorkerModule)).toContain(DeliveryModule);
    const workerProviders = Reflect.getMetadata('providers', WorkerModule) as unknown[];
    const deliveryProviders = Reflect.getMetadata('providers', DeliveryModule) as unknown[];
    const registrations = [workerProviders, deliveryProviders].filter((providers) =>
      providers.includes(FindShipperProcessor),
    );
    expect(registrations).toHaveLength(1);
    expect(Reflect.getMetadata('exports', DeliveryModule)).toContain(DeliveryDispatchService);
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
