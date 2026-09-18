export { AuthGuard, RolesGuard } from 'src/features/auth/public-api';
export {
  CurrentActor,
  type CurrentActor as CurrentActorData,
} from './contracts/current-actor.decorator';
export { IdentityModule } from './identity.module';
export type { IdentityUserSnapshot } from './types/identity.types';
export { IdentityUserQueryService } from './users/identity-user-query.service';
