import { User } from 'src/entities/user.entity';
import { IdentityUserProfileService } from 'src/features/users/users/identity-user-profile.service';

describe('IdentityUserProfileService', () => {
  const repository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates only Identity-owned profile fields', async () => {
    const user = Object.assign(new User(), { id: 'user-1', name: 'Old', phone: '0900' });
    repository.findOne.mockResolvedValue(user);
    repository.save.mockResolvedValue(user);
    const service = new IdentityUserProfileService(repository as never);

    await expect(
      service.updateProfile('user-1', {
        name: 'New',
        phone: '0911',
        birthday: new Date('2000-01-02T00:00:00.000Z'),
      }),
    ).resolves.toEqual(expect.objectContaining({ userId: 'user-1', name: 'New', phone: '0911' }));
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New', phone: '0911' }),
    );
  });
});
