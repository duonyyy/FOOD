// dto/login-driver.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDriverDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
