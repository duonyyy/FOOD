// src/protected/protected.controller.ts
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { AuthenticatedRequest } from 'src/common/auth/authenticated-request';

@Controller('protected')
@ApiBearerAuth('bearer')
export class ProtectedController {
  @Get()
  @UseGuards(AuthGuard)
  getProtectedData(@Req() req: AuthenticatedRequest) {
    // You can now access req.user.uid and use it to fetch further user data
    return { message: 'Protected data accessed', uid: req.user.uid ?? req.user.id };
  }
}
