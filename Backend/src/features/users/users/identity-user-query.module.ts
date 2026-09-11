import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/entities/user.entity';
import { AuthModule } from 'src/features/auth/auth.module';
import { IDENTITY_READER } from '../contracts/identity-reader.port';
import { IdentityUserQueryController } from './identity-user-query.controller';
import { IdentityUserQueryService } from './identity-user-query.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AuthModule],
  controllers: [IdentityUserQueryController],
  providers: [
    IdentityUserQueryService,
    { provide: IDENTITY_READER, useExisting: IdentityUserQueryService },
  ],
  exports: [IDENTITY_READER],
})
export class IdentityUserQueryModule {}
