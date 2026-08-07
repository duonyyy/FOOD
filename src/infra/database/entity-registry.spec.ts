import { ConfigService } from '@nestjs/config';
import dataSource from '../../config/typeorm.data-source';
import { createDatabaseOptions } from './database.options';
import { DATABASE_ENTITIES, DATABASE_ENTITY_NAMES } from './entity-registry';

describe('database entity registry', () => {
  it('is the single entity set used by runtime and the TypeORM CLI data source', () => {
    const runtimeOptions = createDatabaseOptions(new ConfigService());

    expect(runtimeOptions.entities).toBe(DATABASE_ENTITIES);
    expect(dataSource.options.entities).toBe(DATABASE_ENTITIES);
  });

  it('contains every current persistence entity exactly once', () => {
    expect(DATABASE_ENTITY_NAMES).toEqual([
      'Address',
      'Category',
      'Checkout',
      'Conversation',
      'Food',
      'Message',
      'Notification',
      'Order',
      'OrderDetail',
      'PendingShipperAssignment',
      'Permission',
      'Promotion',
      'Restaurant',
      'Review',
      'Role',
      'ShipperCertificateInfo',
      'ShippingDetail',
      'SystemConstraint',
      'Topping',
      'User',
    ]);
    expect(new Set(DATABASE_ENTITIES).size).toBe(DATABASE_ENTITIES.length);
  });
});
