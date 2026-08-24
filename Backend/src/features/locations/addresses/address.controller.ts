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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedRequest } from 'src/auth/interfaces/authenticated-request.interface';
import { AuthGuard } from '../../identity/public-api';
import { AddressService } from './address.service';
import { AddressResponseDto } from './dto/address-response.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Controller('addresses')
@UseGuards(AuthGuard)
@ApiTags('addresses')
@ApiBearerAuth('bearer')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Post()
  @ApiOperation({ summary: 'Create an address for the current customer' })
  @ApiResponse({ status: 201, type: AddressResponseDto })
  createAddress(@Body() dto: CreateAddressDto, @Req() req: AuthenticatedRequest) {
    return this.addressService.createAddressForUser(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List addresses owned by the current customer' })
  @ApiResponse({ status: 200, type: [AddressResponseDto] })
  getAllAddresses(@Req() req: AuthenticatedRequest) {
    return this.addressService.getAddresseByUser(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an address owned by the current customer' })
  @ApiResponse({ status: 200, type: AddressResponseDto })
  @ApiResponse({ status: 403, description: 'Address belongs to another customer' })
  getAddressById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.addressService.getOwnedAddressById(id, req.user.id);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'List addresses for the current customer' })
  getAddressesByUser(@Param('userId') userId: string, @Req() req: AuthenticatedRequest) {
    if (userId !== req.user.id) {
      throw new ForbiddenException("You cannot access another user's addresses");
    }
    return this.addressService.getAddresseByUser(userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an address owned by the current customer' })
  @ApiResponse({ status: 200, type: AddressResponseDto })
  updateAddress(
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.addressService.updateOwnedAddress(id, dto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an address owned by the current customer' })
  @ApiResponse({ status: 200, description: 'Address deleted' })
  deleteAddress(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.addressService.deleteOwnedAddress(id, req.user.id);
  }
}
