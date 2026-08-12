import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/entities/user.entity';
import { IDENTITY_READER } from '../contracts/identity-reader.port';
import { IdentityUserQueryController } from './identity-user-query.controller';
import { IdentityUserQueryService } from './identity-user-query.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [IdentityUserQueryController],
  providers: [
    IdentityUserQueryService,
    { provide: IDENTITY_READER, useExisting: IdentityUserQueryService },
  ],
  exports: [IDENTITY_READER],
})
export class IdentityUserQueryModule {}
