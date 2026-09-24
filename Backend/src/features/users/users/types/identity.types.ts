export interface UserIdentity {
  userId: string;
  username: string;
  name: string | null;
  roleName: string | null;
  isActive: boolean;
}
