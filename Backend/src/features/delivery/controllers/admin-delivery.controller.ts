import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Permission } from 'src/constants/permission.enum';
import { Permissions } from 'src/features/auth/decorators/permissions.decorator';
import { AuthGuard } from 'src/features/auth/guards/auth.guard';
import { RolesGuard } from 'src/features/auth/guards/roles.guard';
import { ShipperProfileStatus } from '../contracts/shipper-profile.port';
import { AdminDeliveryService } from '../services/admin/admin-delivery.service';

@Controller('admin/deliveries')
@ApiTags('admin-delivery')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
export class AdminDeliveryController {
  constructor(private readonly adminDeliveryService: AdminDeliveryService) {}

  @Get('shippers')
  @UseGuards(RolesGuard)
  @Permissions(Permission.SHIPPER.READ)
  @ApiOperation({ summary: 'List shippers with optional status filter' })
  @ApiResponse({ status: 200, description: 'List of registered shippers' })
  async getShippers(@Query('status') status?: ShipperProfileStatus) {
    return this.adminDeliveryService.getShippers(status);
  }

  @Get('shippers/:shipperId')
  @UseGuards(RolesGuard)
  @Permissions(Permission.SHIPPER.READ)
  @ApiOperation({
    summary: 'Get shipper detailed profile, performance metrics and verification info',
  })
  async getShipperDetail(@Param('shipperId') shipperId: string) {
    return this.adminDeliveryService.getShipperDetail(shipperId);
  }

  @Patch('shippers/:userId/approve')
  @UseGuards(RolesGuard)
  @Permissions(Permission.SHIPPER.WRITE)
  @ApiOperation({ summary: 'Approve a driver certificate and activate driver status' })
  async approveShipper(@Param('userId') userId: string) {
    return this.adminDeliveryService.approveShipper(userId);
  }

  @Patch('shippers/:userId/reject')
  @UseGuards(RolesGuard)
  @Permissions(Permission.SHIPPER.WRITE)
  @ApiOperation({ summary: 'Reject a driver certificate with reason' })
  async rejectShipper(@Param('userId') userId: string, @Body('reason') reason?: string) {
    return this.adminDeliveryService.rejectShipper(userId, reason);
  }

  @Get('assignments')
  @UseGuards(RolesGuard)
  @Permissions(Permission.SHIPPER.READ)
  @ApiOperation({ summary: 'Get overview of all active delivery assignments' })
  async getAssignments() {
    return this.adminDeliveryService.getDeliveryAssignmentsOverview();
  }
}
