import { randomUUID } from 'node:crypto';
import AppDataSource from 'src/config/typeorm.data-source';
import { Role } from 'src/entities/role.entity';
import { ShipperProfile } from 'src/entities/shipperProfile.entity';
import { User } from 'src/entities/user.entity';
import { ShipperProfileService } from 'src/features/delivery/services/shipper/shipper-profile.service';
import { UsersService } from 'src/features/users/identity-auth.public-api';

jest.setTimeout(30_000);

const postgresIntegration =
  process.env.FOODEE_RUN_POSTGRES_INTEGRATION === '1' ? describe : describe.skip;

postgresIntegration('Shipper registration PostgreSQL transaction', () => {
  beforeAll(async () => {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
  });

  it('rolls back the new account when the Delivery profile write fails', async () => {
    const username = `shipper-phase3-${randomUUID()}`;
    const users = new UsersService(
      AppDataSource.getRepository(Role),
      AppDataSource.getRepository(User),
    );
    const profiles = new ShipperProfileService(
      AppDataSource.getRepository(ShipperProfile),
      {} as never,
      users,
      AppDataSource,
    );
    const profileWrite = jest
      .spyOn(profiles, 'createPending')
      .mockRejectedValueOnce(new Error('simulated profile write failure'));

    await expect(
      profiles.registerPending({
        username,
        password: 'password123',
        name: 'Test Shipper',
        phone: username,
        birthday: new Date('1999-01-01'),
      }),
    ).rejects.toThrow('simulated profile write failure');
    expect(profileWrite).toHaveBeenCalledTimes(1);
    expect(await AppDataSource.getRepository(User).findOne({ where: { username } })).toBeNull();
  });
});
