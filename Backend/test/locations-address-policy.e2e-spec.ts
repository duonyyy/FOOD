/* eslint-disable @typescript-eslint/no-require-imports */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthGuard } from 'src/features/identity/public-api';
import { AddressController } from 'src/features/locations/addresses/address.controller';
import { AddressService } from 'src/features/locations/addresses/address.service';
import request = require('supertest');

describe('Locations address policy (e2e)', () => {
  let app: INestApplication;
  let authenticated = true;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AddressController],
      providers: [
        {
          provide: AddressService,
          useValue: { getAddresseByUser: jest.fn().mockResolvedValue([]) },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user: unknown } } }) => {
          context.switchToHttp().getRequest().user = { id: 'customer-a' };
          return authenticated;
        },
      })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('allows an authenticated customer to list only their address collection', async () => {
    authenticated = true;

    await request(app.getHttpServer()).get('/addresses').expect(200).expect([]);
  });

  it('returns 403 when authentication denies the address route', async () => {
    authenticated = false;

    await request(app.getHttpServer()).get('/addresses').expect(403);
  });
});
