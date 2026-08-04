import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { RequestRestaurantDto } from './dto/restaurant-request.dto';
import { RestaurantController } from './restaurant.controller';

describe('Restaurant authorization characterization', () => {
  let restaurantService: {
    findByOwnerId: jest.Mock;
    update: jest.Mock;
    requestRestaurantWithFiles: jest.Mock;
  };
  let controller: RestaurantController;

  beforeEach(() => {
    restaurantService = {
      findByOwnerId: jest.fn(),
      update: jest.fn(),
      requestRestaurantWithFiles: jest.fn(),
    };
    controller = new RestaurantController(restaurantService as never);
  });

  it('protects restaurant approval with RolesGuard', () => {
    const approveMethod = Object.getOwnPropertyDescriptor(
      RestaurantController.prototype,
      'approveRestaurant',
    )?.value;
    const guards = Reflect.getMetadata(GUARDS_METADATA, approveMethod) as unknown[];
    expect(guards).toContain(RolesGuard);
  });

  it("returns 403 when Owner A updates Owner B's restaurant", async () => {
    restaurantService.findByOwnerId.mockResolvedValue({ id: 'restaurant-a' });

    await expect(
      controller.update('restaurant-b', {}, { headers: {}, user: { id: 'owner-a' } }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(restaurantService.update.mock.calls).toHaveLength(0);
  });

  it('uses current actor instead of client ownerId for restaurant requests', async () => {
    const maliciousPayload = {
      name: 'Store',
      ownerId: 'owner-b',
    } as unknown as RequestRestaurantDto;

    await controller.requestRestaurantWithFiles(
      maliciousPayload,
      { headers: {}, user: { id: 'owner-a' } },
      {},
    );

    expect(restaurantService.requestRestaurantWithFiles).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'owner-a' }),
      expect.any(Object),
      undefined,
      undefined,
      undefined,
    );
  });
});
