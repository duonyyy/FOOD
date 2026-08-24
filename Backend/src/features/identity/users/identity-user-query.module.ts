import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { User } from 'src/entities/user.entity';
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
