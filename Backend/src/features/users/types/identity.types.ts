export interface IdentityUserSnapshot {
  userId: string;
  username: string;
  name: string | null;
  roleName: string | null;
  isActive: boolean;
}
