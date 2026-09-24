export interface IdentityUserProfileView {
  userId: string;
  name: string | null;
  phone: string | null;
  birthday: Date | null;
}

export interface UpdateIdentityUserProfileCommand {
  name?: string;
  phone?: string;
  birthday?: Date;
}
