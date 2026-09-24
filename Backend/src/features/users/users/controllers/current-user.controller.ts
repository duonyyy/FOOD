import { Body, Controller, Logger, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/features/auth/public-api';
import {
  CurrentActor,
  type CurrentActor as CurrentActorData,
} from '../contracts/current-actor.decorator';
import { UpdateMeDto } from '../dto/update-me.dto';
import { UpdateUserDto } from '../dto/update-users.dto';
import { SafeUserResponse, toSafeUserResponse } from '../mappers/safe-user-response.mapper';
import { UserProfileService } from '../services/user-profile.service';

@Controller('users')
@ApiTags('users')
export class CurrentUserController {
  private readonly logger = new Logger(CurrentUserController.name);

  constructor(private readonly profiles: UserProfileService) {}

  @Put('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update the current user profile (legacy address compatibility)' })
  @ApiResponse({ status: 200, description: 'Safe user response' })
  async updateMe(
    @CurrentActor() actor: CurrentActorData,
    @Body() body: UpdateMeDto,
  ): Promise<SafeUserResponse> {
    const userUpdate: UpdateUserDto = {
      name: body.name,
      phone: body.phone,
      avatar: body.avatar,
      birthday: body.birthday,
      addresses: body.addresses ?? body.address,
    };
    this.logger.debug(`User profile update requested for ${actor.userId}`);

    return toSafeUserResponse(await this.profiles.update(actor.userId, userUpdate));
  }
}
