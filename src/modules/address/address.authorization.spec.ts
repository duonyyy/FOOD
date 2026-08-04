import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { AddressController } from './address.controller';
import { AddressService } from './address.service';

describe('Address authorization characterization', () => {
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let service: AddressService;

  beforeEach(() => {
    repository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    service = new AddressService(repository as never);
  });

  it('protects every address route with AuthGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AddressController) as unknown[];
    expect(guards).toContain(AuthGuard);
  });

  it('uses current actor instead of client-provided id and userId on create', async () => {
    await service.createAddressForUser(
      {
        id: 'client-address-id',
        street: '1 Main Street',
        city: 'HCM',
        userId: 'customer-b',
      },
      'customer-a',
    );

    expect(repository.create).toHaveBeenCalledWith({
      street: '1 Main Street',
      city: 'HCM',
      user: { id: 'customer-a' },
    });
  });

  it("returns 403 when Customer A reads Customer B's address", async () => {
    repository.findOne.mockResolvedValue({ id: 'address-b', user: { id: 'customer-b' } });

    await expect(service.getOwnedAddressById('address-b', 'customer-a')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("returns 403 before querying Customer B's address collection", () => {
    const controller = new AddressController(service);

    expect(() =>
      controller.getAddressesByUser('customer-b', {
        headers: {},
        user: { id: 'customer-a' },
      }),
    ).toThrow(ForbiddenException);
  });
});
