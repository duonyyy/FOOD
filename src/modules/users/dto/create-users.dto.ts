import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { AuthProvider } from 'src/auth/enums/auth-provider.enum';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsOptional()
  password: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsNotEmpty()
  @IsUUID()
  role: string;

  @IsOptional()
  @IsString()
  name?: string;

  // Address is an entity relationship in the User entity, so we shouldn't have it as a simple string
  // Address creation should be handled separately with an AddressDto

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  birthday: Date;

  @IsOptional()
  @IsEnum(AuthProvider)
  authProvider?: AuthProvider = AuthProvider.EMAIL;

  @IsOptional()
  @IsString()
  googleId?: string;
}
