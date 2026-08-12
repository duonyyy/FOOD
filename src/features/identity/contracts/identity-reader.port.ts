export const IDENTITY_READER = Symbol('IDENTITY_READER');

export interface IdentityReaderPort {
  findIdentityUser(userId: string): Promise<IdentityUserSnapshot | null>;
}

export interface IdentityUserSnapshot {
  userId: string;
  username: string;
  name: string | null;
  roleName: string | null;
  isActive: boolean;
}
