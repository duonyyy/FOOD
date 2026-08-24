import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AddressService } from './address.service';

describe('AddressService', () => {
  it('derives ownership from the authenticated actor and never persists client ids', async () => {
    const repository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'address-a', ...value })),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    const service = new AddressService(repository as never);

    await service.createAddressForUser(
      {
        id: 'client-address-id',
        userId: 'customer-b',
        street: '1 Main Street',
        city: 'HCM',
      },
      'customer-a',
    );

    expect(repository.create).toHaveBeenCalledWith({
      street: '1 Main Street',
      city: 'HCM',
      user: { id: 'customer-a' },
    });
  });

  it("rejects Customer A reading Customer B's address", async () => {
    const repository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn().mockResolvedValue({ id: 'address-b', user: { id: 'customer-b' } }),
      find: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    const service = new AddressService(repository as never);

    await expect(service.getOwnedAddressById('address-b', 'customer-a')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('exposes a temporary-address snapshot without leaking the ORM entity', async () => {
    const entity = {
      id: 'temporary-address',
      street: '1 Main Street',
      ward: 'Ward 1',
      district: 'District 1',
      city: 'HCM',
      latitude: 10.7,
      longitude: 106.6,
      isTemporary: true,
    };
    const repository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn().mockResolvedValue(entity),
      find: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    const service = new AddressService(repository as never);

    const snapshot = await service.findTemporaryAddress(entity.id);

    expect(snapshot).toEqual({
      addressId: entity.id,
      street: entity.street,
      ward: entity.ward,
      district: entity.district,
      city: entity.city,
      latitude: entity.latitude,
      longitude: entity.longitude,
      isTemporary: true,
    });
    expect(snapshot).not.toBe(entity);
  });

  it('returns null for a missing location snapshot', async () => {
    const repository = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new AddressService(repository as never);

    await expect(service.findAddress('missing')).resolves.toBeNull();
    await expect(service.getAddressById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
