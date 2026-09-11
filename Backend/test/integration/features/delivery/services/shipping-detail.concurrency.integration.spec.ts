import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import AppDataSource from 'src/config/typeorm.data-source';
import { Order } from 'src/entities/order.entity';
import { ShipperCertificateInfo } from 'src/entities/shipperCertificateInfo.entity';
import { ShippingDetail } from 'src/entities/shippingDetail.entity';
import { User } from 'src/entities/user.entity';
import { DeliveryAssignmentCommandService } from 'src/features/delivery/services/dispatch/delivery-assignment-command.service';
import { ShipperService } from 'src/features/delivery/services/shipper/shipper.service';
import { PendingAssignmentService } from 'src/infra/queue/pending-assignment.service';
import { DataSource } from 'typeorm';

jest.setTimeout(30_000);

const postgresIntegration =
  process.env.FOODEE_RUN_POSTGRES_INTEGRATION === '1' ? describe : describe.skip;

postgresIntegration('ShippingDetail PostgreSQL concurrency contract', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = AppDataSource;
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('allows only one concurrent ShippingDetail for an order', async () => {
    const uniqueIndexes = await dataSource.query<Array<{ indexdef: string }>>(`
      SELECT indexdef
      FROM pg_indexes
      WHERE tablename = 'shippingDetails'
        AND indexdef ILIKE '%UNIQUE%'
        AND indexdef ILIKE '%order_id%'
    `);

    expect(uniqueIndexes).not.toHaveLength(0);

    const availableOrders = await dataSource.query<Array<{ id: string }>>(`
      SELECT o.id
      FROM orders o
      WHERE NOT EXISTS (
        SELECT 1
        FROM "shippingDetails" sd
        WHERE sd.order_id = o.id
      )
      LIMIT 1
    `);
    expect(availableOrders).not.toHaveLength(0);

    const orderId = availableOrders[0].id;
    const firstRunner = dataSource.createQueryRunner();
    const secondRunner = dataSource.createQueryRunner();
    const insertedIds: string[] = [];

    try {
      await Promise.all([firstRunner.connect(), secondRunner.connect()]);

      const insert = `
        INSERT INTO "shippingDetails" ("order_id")
        VALUES ($1)
        RETURNING id
      `;
      const results = await Promise.allSettled([
        firstRunner.query(insert, [orderId]),
        secondRunner.query(insert, [orderId]),
      ]);

      const fulfilled = results.filter(
        (result): result is PromiseFulfilledResult<Array<{ id: string }>> =>
          result.status === 'fulfilled',
      );
      const rejected = results.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const rejection = rejected[0]?.reason as { code?: string };
      expect(rejection.code).toBe('23505');

      insertedIds.push(fulfilled[0].value[0].id);
    } finally {
      if (insertedIds.length > 0) {
        await dataSource.query(`DELETE FROM "shippingDetails" WHERE id = ANY($1::uuid[])`, [
          insertedIds,
        ]);
      }
      await Promise.all([firstRunner.release(), secondRunner.release()]);
    }
  });

  it('allows only one concurrent accept through the Delivery application service', async () => {
    const [shipperRole] = await dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM roles WHERE name = 'shipper' LIMIT 1`,
    );
    expect(shipperRole).toBeDefined();

    const orderId = randomUUID();
    const shipperIds = [
      randomUUID().replaceAll('-', '').slice(0, 28),
      randomUUID().replaceAll('-', '').slice(0, 28),
    ];
    const assignmentIds = [randomUUID(), randomUUID()];
    const usernames = shipperIds.map((shipperId) => `phase4-${shipperId}`);
    const assignments = new Map(
      shipperIds.map((shipperId, index) => [
        shipperId,
        {
          assignmentId: assignmentIds[index],
          orderId,
          shipperId,
          expiresAt: new Date(Date.now() + 120_000),
        },
      ]),
    );
    const pendingAssignmentService = {
      getPendingAssignmentForShipper: jest.fn((shipperId: string) =>
        Promise.resolve(assignments.get(shipperId) ?? null),
      ),
      removePendingAssignment: jest.fn().mockResolvedValue(undefined),
    } as unknown as PendingAssignmentService;

    let applicationModule: TestingModule | undefined;
    try {
      await dataSource.query(
        `INSERT INTO orders (id, status, total, "isPaid", "paymentMethod")
         VALUES ($1, 'confirmed', 100, false, 'cash')`,
        [orderId],
      );

      for (let index = 0; index < shipperIds.length; index += 1) {
        await dataSource.query(
          `INSERT INTO users (id, username, password, birthday, role_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            shipperIds[index],
            usernames[index],
            'test-password',
            new Date('1990-01-01'),
            shipperRole.id,
          ],
        );
        await dataSource.query(
          `INSERT INTO "shipperCertificateInfos" (user_id, status)
           VALUES ($1, 'APPROVED')`,
          [shipperIds[index]],
        );
      }

      applicationModule = await Test.createTestingModule({
        providers: [
          DeliveryAssignmentCommandService,
          ShipperService,
          { provide: getRepositoryToken(Order), useValue: dataSource.getRepository(Order) },
          {
            provide: getRepositoryToken(ShippingDetail),
            useValue: dataSource.getRepository(ShippingDetail),
          },
          { provide: getRepositoryToken(User), useValue: dataSource.getRepository(User) },
          {
            provide: getRepositoryToken(ShipperCertificateInfo),
            useValue: dataSource.getRepository(ShipperCertificateInfo),
          },
          { provide: PendingAssignmentService, useValue: pendingAssignmentService },
        ],
      }).compile();

      const deliveryApplication = applicationModule.get(DeliveryAssignmentCommandService);
      const results = await Promise.allSettled(
        shipperIds.map((shipperId, index) =>
          deliveryApplication.acceptDelivery({
            assignmentId: assignmentIds[index],
            actorId: shipperId,
          }),
        ),
      );

      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected');
      if (fulfilled.length !== 1 || rejected.length !== 1) {
        const reasons = rejected.map((result) =>
          result.reason instanceof Error ? result.reason.message : String(result.reason),
        );
        throw new Error(
          `Expected one accepted and one rejected application command; ` +
            `fulfilled=${fulfilled.length}, rejected=${rejected.length}, ` +
            `reasons=${reasons.join('; ')}`,
        );
      }

      const rows = await dataSource.query<Array<{ user_id: string; status: string }>>(
        `SELECT user_id, status FROM "shippingDetails" WHERE order_id = $1`,
        [orderId],
      );
      expect(rows).toHaveLength(1);
      expect(shipperIds).toContain(rows[0].user_id);
      expect(rows[0].status).toBe('SHIPPING');

      const [updatedOrder] = await dataSource.query<Array<{ status: string }>>(
        `SELECT status FROM orders WHERE id = $1`,
        [orderId],
      );
      expect(updatedOrder.status).toBe('shipper_received');
    } finally {
      await applicationModule?.close();
      await dataSource.query(`DELETE FROM "shippingDetails" WHERE order_id = $1`, [orderId]);
      await dataSource.query(
        `DELETE FROM "shipperCertificateInfos" WHERE user_id = ANY($1::varchar[])`,
        [shipperIds],
      );
      await dataSource.query(`DELETE FROM users WHERE id = ANY($1::varchar[])`, [shipperIds]);
      await dataSource.query(`DELETE FROM orders WHERE id = $1`, [orderId]);
    }
  });
});
