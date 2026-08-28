import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { DeliveryAssignmentCommandService } from './services/delivery-assignment-command.service';

@Controller('delivery/assignments')
@ApiTags('delivery')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
export class DeliveryAssignmentController {
  constructor(private readonly assignmentService: DeliveryAssignmentCommandService) {}

  @Post('offer')
  @ApiOperation({ summary: 'Offer a confirmed order to an eligible shipper' })
  offer(@Body('orderId') orderId: string, @Req() req: any) {
    return this.assignmentService.offerDelivery({ orderId, actorId: this.actorId(req) });
  }

  @Post(':assignmentId/accept')
  @ApiOperation({ summary: 'Accept an assignment owned by the current shipper' })
  accept(@Param('assignmentId') assignmentId: string, @Req() req: any) {
    return this.assignmentService.acceptDelivery({ assignmentId, actorId: this.actorId(req) });
  }

  @Post(':assignmentId/reject')
  @ApiOperation({ summary: 'Reject an assignment owned by the current shipper' })
  reject(@Param('assignmentId') assignmentId: string, @Req() req: any) {
    return this.assignmentService.rejectDelivery({
      assignmentId,
      actorId: this.actorId(req),
    });
  }

  @Post('order/:orderId/reassign')
  @ApiOperation({ summary: 'Reassign an order after rejection or timeout' })
  reassign(@Param('orderId') orderId: string, @Req() req: any) {
    return this.assignmentService.reassignDelivery({
      orderId,
      actorId: this.actorId(req),
      actorRole: req.user?.role?.name ?? req.user?.role,
    });
  }

  private actorId(req: any): string {
    return req.user?.userId || req.user?.uid || req.user?.id;
  }
}
