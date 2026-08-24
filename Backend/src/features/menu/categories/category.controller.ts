import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Permissions } from 'src/auth/decorators/permissions.decorator';
import { Permission } from 'src/constants/permission.enum';
import { RolesGuard } from '../../identity/public-api';
import { CategoryService } from './category.service';
import { CategoryListResponseDto, CategoryResponseDto } from './dto/category-response.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ListCategoryQueryDto } from './dto/list-category-query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({ summary: 'List public food categories' })
  @ApiResponse({ status: 200, type: CategoryListResponseDto })
  findAll(@Query() query: ListCategoryQueryDto): Promise<CategoryListResponseDto> {
    return this.categoryService.findAll(query.page, query.pageSize);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a public food category' })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  @ApiResponse({ status: 404, description: 'Category not found' })
  findOne(@Param('id') id: string): Promise<CategoryResponseDto> {
    return this.categoryService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Permissions(Permission.CATEGORY.CREATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a category (catalog owner/admin)' })
  @ApiResponse({ status: 201, type: CategoryResponseDto })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Missing category create permission' })
  create(@Body() dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    return this.categoryService.create(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Permissions(Permission.CATEGORY.WRITE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a category (catalog owner/admin)' })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Missing category update permission' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto): Promise<CategoryResponseDto> {
    return this.categoryService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Permissions(Permission.CATEGORY.DELETE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a category (catalog owner/admin)' })
  @ApiResponse({ status: 200, description: 'Category deleted' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Missing category delete permission' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  remove(@Param('id') id: string): Promise<void> {
    return this.categoryService.remove(id);
  }
}
