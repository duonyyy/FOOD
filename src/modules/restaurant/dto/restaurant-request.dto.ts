import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateRestaurantDto } from './create-restaurant.dto';

export class RequestRestaurantDto extends OmitType(CreateRestaurantDto, [
  'ownerId',
  'status',
] as const) {}

export class UpdateOwnedRestaurantDto extends PartialType(RequestRestaurantDto) {}
