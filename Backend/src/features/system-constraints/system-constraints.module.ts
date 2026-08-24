import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemConstraint } from '../../entities/systemConstaints.entity';
import { SystemConstraintsService } from '../../services/system-constraints.service';

/**
 * Compatibility owner for operating-policy configuration. The service source stays
 * in its legacy location until a later vertical slice can move implementation code.
 */
@Module({
  imports: [TypeOrmModule.forFeature([SystemConstraint])],
  providers: [SystemConstraintsService],
  exports: [SystemConstraintsService],
})
export class SystemConstraintsModule {}
