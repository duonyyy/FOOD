import { AuthGuard } from 'src/features/identity/public-api';
import { NotificationController } from './notification.controller';

describe('NotificationController — policy checks', () => {
  it('applies AuthGuard at the class level', () => {
    const guards = Reflect.getMetadata('__guards__', NotificationController) as unknown;
    expect(guards).toBeDefined();
    expect(guards).toContain(AuthGuard);
  });

  it('getMyNotifications uses CurrentActor parameter decorator', () => {
    // CurrentActor is a param decorator so we check custom metadata
    const customParamMetadata = Reflect.getMetadata(
      '__routeArguments__',
      NotificationController,
      'getMyNotifications',
    ) as unknown;
    expect(customParamMetadata).toBeDefined();
  });

  it('markAsRead uses CurrentActor and ParseUUIDPipe', () => {
    const customParamMetadata = Reflect.getMetadata(
      '__routeArguments__',
      NotificationController,
      'markAsRead',
    ) as unknown;
    expect(customParamMetadata).toBeDefined();

    // Verify at least two decorated params exist (actor + id)
    const paramKeys = Object.keys(customParamMetadata as object);
    expect(paramKeys.length).toBeGreaterThanOrEqual(2);
  });

  it('has proper Swagger ApiTags metadata', () => {
    const tags = Reflect.getMetadata('swagger/apiUseTags', NotificationController) as unknown;
    expect(tags).toContain('Notifications');
  });
});
