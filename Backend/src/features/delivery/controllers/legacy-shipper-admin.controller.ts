import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Permission } from 'src/constants/permission.enum';
import { Permissions, RolesGuard } from 'src/features/auth/public-api';
import { ShipperProfileStatus } from '../contracts/shipper-profile.port';
import { AdminDeliveryService } from '../services/admin/admin-delivery.service';

/**
 * Compatibility routes retained for existing clients. Their implementation is
 * deliberately owned by Delivery rather than the Users feature.
 */
@Controller('users')
@ApiTags('delivery-compatibility')
@ApiBearerAuth('bearer')
@UseGuards(RolesGuard)
export class LegacyShipperAdminController {
  constructor(private readonly adminDeliveryService: AdminDeliveryService) {}

  @Get('shippers')
  @Permissions(Permission.SHIPPER.READ)
  @ApiOperation({ summary: 'List shipper projections (legacy users route)' })
  @ApiResponse({ status: 200, description: 'Safe Delivery-owned shipper projections' })
  getShippers(@Query('status') status?: ShipperProfileStatus) {
    return this.adminDeliveryService.getShippers(status);
  }

  @Patch('shippers/:userId/approve')
  @Permissions(Permission.SHIPPER.WRITE)
  @ApiOperation({ summary: 'Approve a shipper (legacy users route)' })
  approveShipper(@Param('userId') userId: string) {
    return this.adminDeliveryService.approveShipper(userId);
  }

  @Patch('shippers/:userId/reject')
  @Permissions(Permission.SHIPPER.WRITE)
  @ApiOperation({ summary: 'Reject a shipper (legacy users route)' })
  rejectShipper(@Param('userId') userId: string) {
    return this.adminDeliveryService.rejectShipper(userId);
  }
}
