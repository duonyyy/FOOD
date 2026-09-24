import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/features/auth/public-api';
import {
  CurrentActor,
  type CurrentActor as CurrentActorData,
} from '../contracts/current-actor.decorator';
import { IdentityUserResponseDto } from '../dto/identity-user-response.dto';
import { IdentityUserQueryService } from '../services/identity-user-query.service';

@ApiTags('users')
@Controller('users')
export class CurrentUserQueryController {
  constructor(private readonly identityUserQueryService: IdentityUserQueryService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiResponse({ status: 200, type: IdentityUserResponseDto })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  findMe(@CurrentActor() actor: CurrentActorData): Promise<IdentityUserResponseDto> {
    return this.identityUserQueryService.findCurrentUser(actor.userId);
  }
}
