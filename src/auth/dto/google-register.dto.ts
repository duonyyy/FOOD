import { IsString, IsNotEmpty, IsEmail, IsOptional } from 'class-validator';

export class GoogleRegisterDto {
  @IsString()
  @IsOptional()
  googleId?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsNotEmpty()
  accessToken: string;
}
