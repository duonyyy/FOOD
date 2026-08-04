import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { UpdateAddressDto } from 'src/modules/address/dto/update-address.dto';
import { CreateUserDto } from './create-users.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAddressDto)
  addresses?: UpdateAddressDto[];
}
