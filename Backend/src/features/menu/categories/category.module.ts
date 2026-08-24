import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from 'src/entities/category.entity';
import { IdentityModule } from '../../identity/public-api';
import { CATEGORY_READER } from '../contracts/category-reader.port';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

@Module({
  imports: [TypeOrmModule.forFeature([Category]), IdentityModule],
  controllers: [CategoryController],
  providers: [CategoryService, { provide: CATEGORY_READER, useExisting: CategoryService }],
  exports: [CATEGORY_READER],
})
export class CategoryModule {}
