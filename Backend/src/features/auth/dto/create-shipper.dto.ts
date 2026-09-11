import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateShipperDto {
  @ApiProperty({ example: '0901234567' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Nguyễn Văn Tài' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '0901234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '1999-01-01' }) // ISO 8601 format
  @IsDateString()
  birthday: string;

  @ApiProperty({ example: '123456789012' })
  @IsString()
  @IsNotEmpty()
  cccd: string;

  @ApiProperty({ example: 'B123456789' })
  @IsString()
  @IsNotEmpty()
  driverLicense: string;
}
