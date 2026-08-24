/* eslint-disable @typescript-eslint/no-require-imports */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RolesGuard } from 'src/features/identity/public-api';
import { CategoryController } from 'src/features/menu/categories/category.controller';
import { CategoryService } from 'src/features/menu/categories/category.service';
import request = require('supertest');

describe('Category policy (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [
        {
          provide: CategoryService,
          useValue: {
            findAll: jest.fn().mockResolvedValue({
              items: [],
              totalItems: 0,
              page: 1,
              pageSize: 10,
              totalPages: 0,
            }),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => false })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('allows public category reads', async () => {
    await request(app.getHttpServer())
      .get('/categories?page=1&pageSize=10')
      .expect(200)
      .expect({ items: [], totalItems: 0, page: 1, pageSize: 10, totalPages: 0 });
  });

  it('rejects category writes when the permission guard denies access', async () => {
    await request(app.getHttpServer()).post('/categories').send({ name: 'Món Việt' }).expect(403);
  });
});
