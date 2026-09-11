import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedRequest } from 'src/common/auth/authenticated-request';
import { AuthGuard } from 'src/features/auth/guards/auth.guard';
import { DeliveryDispatchService } from '../services/dispatch/delivery-dispatch.service';
import { DeliveryReportService } from '../services/shipper/delivery-report.service';
import { ShipperDeliveryService } from '../services/shipper/shipper-delivery.service';
import { ShipperProfileService } from '../services/shipper/shipper-profile.service';

@Controller('shippers')
@ApiTags('delivery')
@ApiBearerAuth('bearer')
export class ShipperDeliveryController {
  constructor(
    protected readonly shipperDeliveryService: ShipperDeliveryService,
    protected readonly shipperProfileService: ShipperProfileService,
    protected readonly deliveryReportService: DeliveryReportService,
  ) {}

  @Post('accept-order')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Accept an assigned order' })
  async acceptOrder(
    @Body('orderId') orderId: string,
    @Body('responseTimeSeconds') responseTimeSeconds: number,
    @Req() req: AuthenticatedRequest,
  ) {
    if (responseTimeSeconds === undefined) {
      responseTimeSeconds = 0;
    }
    const shipperId = req.user.uid || req.user.id;
    return this.shipperDeliveryService.assignOrderToShipper(
      orderId,
      shipperId,
      responseTimeSeconds,
    );
  }

  @Post('get-order')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Read an assigned order without changing delivery state' })
  @ApiResponse({ status: 200, description: 'Assigned order returned' })
  async getOrder(@Body('orderId') orderId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.userId || req.user?.uid || req.user?.id;
    if (!orderId) {
      throw new BadRequestException('Order ID is required');
    }
    return this.shipperDeliveryService.getOrder(orderId, userId);
  }

  @Post('start-order')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Start an assigned delivery' })
  @ApiResponse({ status: 201, description: 'Order transitioned to delivering' })
  async startOrder(@Body('orderId') orderId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.userId || req.user?.uid || req.user?.id;
    if (!orderId) {
      throw new BadRequestException('Order ID is required');
    }
    return this.shipperDeliveryService.startOrder(orderId, userId);
  }

  @Post('complete-order')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Mark an order as completed by shipper' })
  async completeOrder(@Body('orderId') orderId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.userId || req.user?.uid || req.user?.id;
    return this.shipperDeliveryService.markOrderCompleted(orderId, userId);
  }

  @Post('cancel-order')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Cancel an active delivery order' })
  async cancelOrder(@Body('orderId') orderId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.userId || req.user?.uid || req.user?.id;
    return this.shipperDeliveryService.cancelOrder(orderId, userId);
  }

  @Post('reject-order')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Reject an offered order' })
  async rejectOrder(
    @Body('orderId') orderId: string,
    @Body('responseTimeSeconds') responseTimeSeconds: number,
    @Req() req: AuthenticatedRequest,
  ) {
    if (responseTimeSeconds === undefined) {
      responseTimeSeconds = 0;
    }
    const shipperId = req.user.uid || req.user.id;
    return this.shipperDeliveryService.rejectOrder(orderId, shipperId, responseTimeSeconds);
  }

  @Get('pending-assignment')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get current pending assignment hold for shipper' })
  async getPendingAssignment(@Req() req: AuthenticatedRequest) {
    const shipperId = req.user.uid || req.user.id;
    return this.shipperDeliveryService.getPendingAssignmentForShipper(shipperId);
  }

  @Get('order-history')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get completed delivery orders history' })
  async getHistory(@Req() req: AuthenticatedRequest) {
    const shipperId = req.user.id;
    return this.shipperDeliveryService.getCompletedOrdersByShipper(shipperId);
  }

  @Get('profile')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get shipper profile information' })
  async getProfile(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.shipperProfileService.getDriverProfile(userId);
  }

  @Get('income-report')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get income report by time range' })
  async getIncomeReport(
    @Req() req: AuthenticatedRequest,
    @Query('range') range: 'today' | 'week' | 'month',
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const shipperId = req.user.id;
    return this.deliveryReportService.getIncomeReport(shipperId, range, month, year);
  }

  @Post('update-location')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Update driver real-time GPS coordinates' })
  async updateLocation(
    @Body('latitude') latitude: number,
    @Body('longitude') longitude: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const shipperId = req.user.uid || req.user.id;
    return this.shipperProfileService.updateLocation(shipperId, latitude, longitude);
  }

  @Get('dashboard')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get comprehensive shipper dashboard statistics' })
  async getDashboard(@Req() req: AuthenticatedRequest) {
    const shipperId = req.user.id;
    return this.deliveryReportService.getShipperDashboard(shipperId);
  }

  @Get('performance')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get shipper performance metrics' })
  async getPerformanceStats(@Req() req: AuthenticatedRequest) {
    const shipperId = req.user.id;
    return this.deliveryReportService.getShipperStats(shipperId);
  }

  @Get('earnings-breakdown')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get earnings breakdown from dashboard' })
  async getEarningsBreakdown(@Req() req: AuthenticatedRequest) {
    const shipperId = req.user.id;
    const shipper = await this.deliveryReportService.getShipperDashboard(shipperId);
    return shipper.earnings;
  }

  @Get('achievements')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get shipper achievement badges and rankings' })
  async getAchievements(@Req() req: AuthenticatedRequest) {
    const shipperId = req.user.id;
    const dashboard = await this.deliveryReportService.getShipperDashboard(shipperId);
    return {
      achievements: dashboard.achievements,
      performanceRanking: dashboard.performanceRanking,
      nextMilestones: dashboard.nextMilestones,
    };
  }
}

/** Compatibility controller for legacy/external /delivery/assignments routes */
@Controller('delivery/assignments')
@ApiTags('delivery')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
export class DeliveryAssignmentController {
  constructor(private readonly dispatchService: DeliveryDispatchService) {}

  @Post('offer')
  @ApiOperation({ summary: 'Offer a confirmed order to an eligible shipper' })
  offer(@Body('orderId') orderId: string, @Req() req: AuthenticatedRequest) {
    return this.dispatchService.offerDelivery({ orderId, actorId: this.actorId(req) });
  }

  @Post(':assignmentId/accept')
  @ApiOperation({ summary: 'Accept an assignment owned by the current shipper' })
  accept(@Param('assignmentId') assignmentId: string, @Req() req: AuthenticatedRequest) {
    return this.dispatchService.acceptDelivery({ assignmentId, actorId: this.actorId(req) });
  }

  @Post(':assignmentId/reject')
  @ApiOperation({ summary: 'Reject an assignment owned by the current shipper' })
  reject(@Param('assignmentId') assignmentId: string, @Req() req: AuthenticatedRequest) {
    return this.dispatchService.rejectDelivery({
      assignmentId,
      actorId: this.actorId(req),
    });
  }

  @Post('order/:orderId/reassign')
  @ApiOperation({ summary: 'Reassign an order after rejection or timeout' })
  reassign(@Param('orderId') orderId: string, @Req() req: AuthenticatedRequest) {
    return this.dispatchService.reassignDelivery({
      orderId,
      actorId: this.actorId(req),
      actorRole: roleName(req.user.role),
    });
  }

  private actorId(req: AuthenticatedRequest): string {
    return req.user.userId ?? req.user.uid ?? req.user.id;
  }
}

function roleName(role: unknown): string | undefined {
  if (typeof role === 'string') return role;
  if (role && typeof role === 'object' && 'name' in role && typeof role.name === 'string') {
    return role.name;
  }
  return undefined;
}

/** Compatibility aliases */
export const ShipperController = ShipperDeliveryController;
export type ShipperController = ShipperDeliveryController;
export const DeliveryDispatchController = DeliveryAssignmentController;
export type DeliveryDispatchController = DeliveryAssignmentController;
