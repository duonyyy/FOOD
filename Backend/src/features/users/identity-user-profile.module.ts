import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/entities/user.entity';
import { IdentityUserProfileService } from './users/identity-user-profile.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [IdentityUserProfileService],
  exports: [IdentityUserProfileService],
})
export class IdentityUserProfileModule {}
