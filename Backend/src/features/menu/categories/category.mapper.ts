import { Category } from 'src/entities/category.entity';
import { CategoryFoodResponseDto, CategoryResponseDto } from './dto/category-response.dto';

type CategoryWithFoodCount = Category & { foodCount?: number };

export function toCategoryResponse(category: CategoryWithFoodCount): CategoryResponseDto {
  const response = new CategoryResponseDto();
  response.id = category.id;
  response.name = category.name ?? null;
  response.image = category.image ?? null;
  response.foodCount = category.foodCount ?? category.foods?.length ?? 0;

  if (category.foods) {
    response.foods = category.foods.map(toCategoryFoodResponse);
  }

  return response;
}

function toCategoryFoodResponse(food: Category['foods'][number]): CategoryFoodResponseDto {
  const response = new CategoryFoodResponseDto();
  response.id = food.id;
  response.name = food.name ?? null;
  response.image = food.image ?? null;
  response.imageUrls = food.imageUrls ?? null;
  response.description = food.description ?? null;
  response.price = food.price ?? null;
  response.discountPercent = food.discountPercent ?? null;
  response.status = food.status ?? null;
  response.tag = food.tag ?? null;
  response.rating = food.rating ?? null;
  response.preparationTime = food.preparationTime ?? null;
  return response;
}
