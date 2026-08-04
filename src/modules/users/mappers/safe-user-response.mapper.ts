import { User } from 'src/entities/user.entity';

export type SafeUserResponse = Omit<
  User,
  'password' | 'googleId' | 'resetPasswordToken' | 'resetPasswordExpires'
>;

export function toSafeUserResponse(user: User): SafeUserResponse {
  const response = { ...user } as Partial<User>;
  delete response.password;
  delete response.googleId;
  delete response.resetPasswordToken;
  delete response.resetPasswordExpires;
  return response as SafeUserResponse;
}
