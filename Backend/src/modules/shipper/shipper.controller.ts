import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { AuthenticatedRequest } from 'src/common/auth/authenticated-request';
import { ShipperService } from './shipper.service';

@Controller('shippers')
@ApiTags('delivery')
@ApiBearerAuth('bearer')
export class ShipperController {
  constructor(private readonly shipperService: ShipperService) {}

  @Post('accept-order')
  @UseGuards(AuthGuard)
  async acceptOrder(
    @Body('orderId') orderId: string,
    @Body('responseTimeSeconds') responseTimeSeconds: number,
    @Req() req: AuthenticatedRequest,
  ) {
    if (responseTimeSeconds === undefined) {
      responseTimeSeconds = 0; // Default to 0 if not provided
    }
    const shipperId = req.user.uid || req.user.id;
    // The service method will need to be updated to accept this new parameter
    return this.shipperService.assignOrderToShipper(orderId, shipperId, responseTimeSeconds);
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
    return this.shipperService.getOrder(orderId, userId);
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
    return this.shipperService.startOrder(orderId, userId);
  }

  @UseGuards(AuthGuard)
  @Post('complete-order')
  async completeOrder(@Body('orderId') orderId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.userId || req.user?.uid || req.user?.id;
    return this.shipperService.markOrderCompleted(orderId, userId);
  }

  @UseGuards(AuthGuard)
  @Post('cancel-order')
  async cancelOrder(@Body('orderId') orderId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.userId || req.user?.uid || req.user?.id;
    return this.shipperService.cancelOrder(orderId, userId);
  }

  @UseGuards(AuthGuard)
  @Post('reject-order')
  async rejectOrder(
    @Body('orderId') orderId: string,
    @Body('responseTimeSeconds') responseTimeSeconds: number,
    @Req() req: AuthenticatedRequest,
  ) {
    if (responseTimeSeconds === undefined) {
      responseTimeSeconds = 0; // Default to 0 if not provided
    }
    const shipperId = req.user.uid || req.user.id;
    // The service method will need to be updated to accept this new parameter
    return this.shipperService.rejectOrder(orderId, shipperId, responseTimeSeconds);
  }

  @Get('pending-assignment')
  @UseGuards(AuthGuard)
  async getPendingAssignment(@Req() req: AuthenticatedRequest) {
    const shipperId = req.user.uid || req.user.id;
    return this.shipperService.getPendingAssignmentForShipper(shipperId);
  }

  // Keep the original endpoint for backward compatibility

  @UseGuards(AuthGuard)
  @Get('order-history')
  async getHistory(@Req() req: AuthenticatedRequest) {
    const shipperId = req.user.id;
    return this.shipperService.getCompletedOrdersByShipper(shipperId);
  }

  @UseGuards(AuthGuard)
  @Get('profile')
  async getProfile(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.shipperService.getDriverProfile(userId);
  }

  @Get('income-report')
  @UseGuards(AuthGuard)
  async getIncomeReport(
    @Req() req: AuthenticatedRequest,
    @Query('range') range: 'today' | 'week' | 'month',
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const shipperId = req.user.id;
    return this.shipperService.getIncomeReport(shipperId, range, month, year);
  }

  @Post('update-location')
  @UseGuards(AuthGuard)
  async updateLocation(
    @Body('latitude') latitude: number,
    @Body('longitude') longitude: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const shipperId = req.user.uid || req.user.id;
    //log(`Updating location for shipper ${shipperId}: ${latitude}, ${longitude}`);
    return this.shipperService.updateLocation(shipperId, latitude, longitude);
  }

  @Get('dashboard')
  @UseGuards(AuthGuard)
  async getDashboard(@Req() req: AuthenticatedRequest) {
    const shipperId = req.user.id;
    return this.shipperService.getShipperDashboard(shipperId);
  }

  @Get('performance')
  @UseGuards(AuthGuard)
  async getPerformanceStats(@Req() req: AuthenticatedRequest) {
    const shipperId = req.user.id;
    return this.shipperService.getShipperStats(shipperId);
  }

  @Get('earnings-breakdown')
  @UseGuards(AuthGuard)
  async getEarningsBreakdown(@Req() req: AuthenticatedRequest) {
    const shipperId = req.user.id;
    const shipper = await this.shipperService.getShipperDashboard(shipperId);
    return shipper.earnings;
  }

  @Get('achievements')
  @UseGuards(AuthGuard)
  async getAchievements(@Req() req: AuthenticatedRequest) {
    const shipperId = req.user.id;
    const dashboard = await this.shipperService.getShipperDashboard(shipperId);
    return {
      achievements: dashboard.achievements,
      performanceRanking: dashboard.performanceRanking,
      nextMilestones: dashboard.nextMilestones,
    };
  }
}
