import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { AuthenticatedRequest } from 'src/auth/interfaces/authenticated-request.interface';
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Controller('addresses')
@UseGuards(AuthGuard)
@ApiTags('addresses')
@ApiBearerAuth('bearer')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Post()
  createAddress(@Body() createAddressDto: CreateAddressDto, @Req() req: AuthenticatedRequest) {
    return this.addressService.createAddressForUser(createAddressDto, req.user.id);
  }

  @Get()
  getAllAddresses(@Req() req: AuthenticatedRequest) {
    return this.addressService.getAddresseByUser(req.user.id);
  }

  @Get(':id')
  getAddressById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.addressService.getOwnedAddressById(id, req.user.id);
  }

  @Get('user/:userId')
  getAddressesByUser(@Param('userId') userId: string, @Req() req: AuthenticatedRequest) {
    if (userId !== req.user.id) {
      throw new ForbiddenException("You cannot access another user's addresses");
    }
    return this.addressService.getAddresseByUser(userId);
  }

  @Put(':id')
  updateAddress(
    @Param('id') id: string,
    @Body() updateAddressDto: UpdateAddressDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.addressService.updateOwnedAddress(id, updateAddressDto, req.user.id);
  }

  @Delete(':id')
  deleteAddress(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.addressService.deleteOwnedAddress(id, req.user.id);
  }
}
