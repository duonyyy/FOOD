import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { AuthenticatedRequest } from '../../common/auth/authenticated-request';
import { DeliveryAssignmentCommandService } from './services/delivery-assignment-command.service';

@Controller('delivery/assignments')
@ApiTags('delivery')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
export class DeliveryAssignmentController {
  constructor(private readonly assignmentService: DeliveryAssignmentCommandService) {}

  @Post('offer')
  @ApiOperation({ summary: 'Offer a confirmed order to an eligible shipper' })
  offer(@Body('orderId') orderId: string, @Req() req: AuthenticatedRequest) {
    return this.assignmentService.offerDelivery({ orderId, actorId: this.actorId(req) });
  }

  @Post(':assignmentId/accept')
  @ApiOperation({ summary: 'Accept an assignment owned by the current shipper' })
  accept(@Param('assignmentId') assignmentId: string, @Req() req: AuthenticatedRequest) {
    return this.assignmentService.acceptDelivery({ assignmentId, actorId: this.actorId(req) });
  }

  @Post(':assignmentId/reject')
  @ApiOperation({ summary: 'Reject an assignment owned by the current shipper' })
  reject(@Param('assignmentId') assignmentId: string, @Req() req: AuthenticatedRequest) {
    return this.assignmentService.rejectDelivery({
      assignmentId,
      actorId: this.actorId(req),
    });
  }

  @Post('order/:orderId/reassign')
  @ApiOperation({ summary: 'Reassign an order after rejection or timeout' })
  reassign(@Param('orderId') orderId: string, @Req() req: AuthenticatedRequest) {
    return this.assignmentService.reassignDelivery({
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
