import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/entities/user.entity';
import { AuthModule } from 'src/features/auth/auth-module.public-api';
import { IdentityUserQueryController } from './identity-user-query.controller';
import { IdentityUserQueryService } from './identity-user-query.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AuthModule],
  controllers: [IdentityUserQueryController],
  providers: [IdentityUserQueryService],
  exports: [IdentityUserQueryService],
})
export class IdentityUserQueryModule {}
