import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Food } from 'src/entities/food.entity';
import { MENU_READER } from '../contracts/menu-reader.port';
import { MenuReaderService } from './menu-reader.service';

@Module({
  imports: [TypeOrmModule.forFeature([Food])],
  providers: [MenuReaderService, { provide: MENU_READER, useExisting: MenuReaderService }],
  exports: [MENU_READER],
})
export class MenuReaderModule {}
